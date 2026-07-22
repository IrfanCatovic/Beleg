package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testFinishHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionSignupRequest{},
		&models.ActionInviteLink{},
		&models.Transakcija{},
		&models.Obavestenje{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func callZavrsiAkciju(t *testing.T, db *gorm.DB, akcijaID uint, username, role string, body any) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/zavrsi", &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	ZavrsiAkciju(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func callUpdatePrijavaStatus(t *testing.T, db *gorm.DB, prijavaID uint, status, username, role string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]string{"status": status})
	c.Request = httptest.NewRequest(http.MethodPost, "/prijave/"+strconv.FormatUint(uint64(prijavaID), 10)+"/status", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijavaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	UpdatePrijavaStatus(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestZavrsiAkciju_UnresolvedParticipantsReturns409(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "zav_owner", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "HTTP finish", Datum: time.Now().Add(24 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	mem := models.Korisnik{Username: "zav_mem", Password: "x", Role: "clan"}
	if err := db.Create(&mem).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: mem.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callZavrsiAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]float64{"rashodNaAkciji": 0})
	if code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaHasUnresolvedParticipants.Error() {
		t.Fatalf("unexpected error: %v", body["error"])
	}
	var a models.Akcija
	if err := db.First(&a, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if a.IsCompleted {
		t.Fatal("must remain incomplete")
	}
}

func TestZavrsiAkciju_Unauthorized(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "zav_own2", Password: "x", Role: "vodic"}
	stranger := models.Korisnik{Username: "zav_str", Password: "x", Role: "clan"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Private finish", Datum: time.Now().Add(24 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callZavrsiAkciju(t, db, akcija.ID, stranger.Username, "clan", map[string]float64{"rashodNaAkciji": 0})
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
}

func TestFinishVsStatusUpdate_StatusFirstThenFinish(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "race_own", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Race", Datum: time.Now().Add(24 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	mem := models.Korisnik{Username: "race_mem", Password: "x", Role: "clan"}
	if err := db.Create(&mem).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: mem.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callUpdatePrijavaStatus(t, db, p.ID, "popeo se", owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status update %d", code)
	}
	code, body := callZavrsiAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]float64{"rashodNaAkciji": 0})
	if code != http.StatusOK {
		t.Fatalf("finish after resolve expected 200, got %d body=%v", code, body)
	}
}

func TestFinishVsStatusUpdate_FinishSeesPrijavljen(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "race_own2", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Race2", Datum: time.Now().Add(24 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	mem := models.Korisnik{Username: "race_mem2", Password: "x", Role: "clan"}
	if err := db.Create(&mem).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: mem.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callZavrsiAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]float64{"rashodNaAkciji": 0})
	if code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%v", code, body)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.Status != "prijavljen" {
		t.Fatalf("status must stay prijavljen, got %s", reloaded.Status)
	}
}

func TestFinishVsDelete_FinishThenDeleteConflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "fd_own", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "FD", Datum: time.Now().Add(24 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callZavrsiAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]float64{"rashodNaAkciji": 0})
	if code != http.StatusOK {
		t.Fatalf("finish %d", code)
	}
	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("delete after finish expected 409, got %d body=%v", code, body)
	}
}

func TestParallelFinish_HTTPOneWins(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "par_http", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "ParHTTP", Datum: time.Now().Add(24 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic", CenaClan: 50,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	mem := models.Korisnik{Username: "par_http_m", Password: "x", Role: "clan"}
	if err := db.Create(&mem).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: mem.ID, Status: "popeo se", Platio: true,
	}).Error; err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callZavrsiAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]float64{"rashodNaAkciji": 0})
		}(i)
	}
	wg.Wait()

	ok, bad := 0, 0
	for _, code := range codes {
		switch code {
		case http.StatusOK:
			ok++
		case http.StatusBadRequest:
			bad++
		default:
			t.Fatalf("unexpected status %d in %v", code, codes)
		}
	}
	if ok != 1 || bad != 1 {
		t.Fatalf("expected one 200 and one 400 AlreadyComplete, got %v", codes)
	}
}

func TestEnsureNoUnresolved_HelperDirect(t *testing.T) {
	db := testFinishHandlerDB(t)
	akcija := models.Akcija{Naziv: "H", Datum: time.Now().Add(24 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		return helpers.EnsureNoUnresolvedParticipantResultsTx(tx, akcija.ID)
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: 1, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		return helpers.EnsureNoUnresolvedParticipantResultsTx(tx, akcija.ID)
	})
	if !errors.Is(err, helpers.ErrAkcijaHasUnresolvedParticipants) {
		t.Fatalf("expected unresolved, got %v", err)
	}
}
