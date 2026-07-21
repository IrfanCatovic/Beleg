package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPrijaviDB(t *testing.T) *gorm.DB {
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
		&models.AkcijaSmestaj{},
		&models.AkcijaPrevoz{},
		&models.AkcijaOpremaRent{},
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

func callPrijaviNaAkciju(t *testing.T, db *gorm.DB, akcijaID uint, username string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/prijava", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	PrijaviNaAkciju(c)

	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func countPendingSignups(t *testing.T, db *gorm.DB, akcijaID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND status = ?", akcijaID, models.ActionSignupRequestPending).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func TestPrijaviNaAkciju_CreatesPendingWhenCapacityAvailable(t *testing.T) {
	db := testPrijaviDB(t)
	user := models.Korisnik{Username: "u1", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Open", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 5, Javna: true, IsCompleted: false,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("expected one pending signup request")
	}
}

func TestPrijaviNaAkciju_RejectsWhenFull(t *testing.T) {
	db := testPrijaviDB(t)
	guide := models.Korisnik{Username: "guide", Password: "x", Role: "vodic"}
	user := models.Korisnik{Username: "late", Password: "x", Role: "clan"}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Full", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 1, Javna: true, VodicID: guide.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", code)
	}
	if body["error"] != helpers.ErrAkcijaCapacityFull.Error() {
		t.Fatalf("expected %q, got %v", helpers.ErrAkcijaCapacityFull.Error(), body["error"])
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("pending request must not be created when full")
	}
}

func TestPrijaviNaAkciju_MaxLjudiZeroUnlimited(t *testing.T) {
	db := testPrijaviDB(t)
	user := models.Korisnik{Username: "u0", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Unlimited", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 0, Javna: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 8; i++ {
		u := models.Korisnik{Username: "m" + strconv.Itoa(i), Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.Prijava{
			AkcijaID: akcija.ID, KorisnikID: u.ID, Status: "prijavljen",
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("maxLjudi=0 should allow request, status=%d body=%v", code, body)
	}
}

func TestPrijaviNaAkciju_PendingDoNotOccupyCapacity(t *testing.T) {
	db := testPrijaviDB(t)
	akcija := models.Akcija{
		Naziv: "OneSlot", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 1, Javna: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	// Two pending requests from other users — must not fill capacity.
	for i := 0; i < 2; i++ {
		u := models.Korisnik{Username: "pend" + strconv.Itoa(i), Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		req := models.ActionSignupRequest{
			AkcijaID: akcija.ID, RequesterID: u.ID, Status: models.ActionSignupRequestPending,
		}
		if err := db.Create(&req).Error; err != nil {
			t.Fatal(err)
		}
	}
	user := models.Korisnik{Username: "newcomer", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("pending must not block new request, status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 3 {
		t.Fatalf("expected 3 pending, got %d", countPendingSignups(t, db, akcija.ID))
	}
}

func TestPrijaviNaAkciju_AcceptStillChecksCapacityAfterRequest(t *testing.T) {
	db := testPrijaviDB(t)
	requester := models.Korisnik{Username: "req", Password: "x", Role: "clan"}
	filler := models.Korisnik{Username: "fill", Password: "x", Role: "clan"}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&filler).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Race", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 1, Javna: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, requester.Username)
	if code != http.StatusOK {
		t.Fatalf("request should succeed while empty, status=%d body=%v", code, body)
	}

	// Capacity filled after request was created.
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: filler.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := createPrijavaFromChoices(tx, akcija.ID, requester, prijavaChoicesPayload{})
		return err
	})
	if err == nil || err.Error() != helpers.ErrAkcijaCapacityFull.Error() {
		t.Fatalf("accept must still reject when full, got %v", err)
	}
}

func TestPrijaviNaAkciju_GuideCountsTowardEarlyCapacity(t *testing.T) {
	db := testPrijaviDB(t)
	guide := models.Korisnik{Username: "g1", Password: "x", Role: "vodic"}
	user := models.Korisnik{Username: "u2", Password: "x", Role: "clan"}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "GuideSlot", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 1, Javna: true, VodicID: guide.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest || body["error"] != helpers.ErrAkcijaCapacityFull.Error() {
		t.Fatalf("guide should occupy capacity for early guard, got %d %v", code, body)
	}
}

func TestPrijaviNaAkciju_CompletedTakesPriorityOverCapacity(t *testing.T) {
	db := testPrijaviDB(t)
	user := models.Korisnik{Username: "u3", Password: "x", Role: "clan"}
	other := models.Korisnik{Username: "u4", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "DoneFull", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 1, Javna: true, IsCompleted: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: other.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status %d", code)
	}
	errMsg, _ := body["error"].(string)
	if !strings.Contains(errMsg, "završena") {
		t.Fatalf("lifecycle error should take priority, got %q", errMsg)
	}
	if strings.Contains(errMsg, "popunjena") {
		t.Fatalf("should not report capacity-only error for completed action: %q", errMsg)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending on completed action")
	}
}

func TestPrijaviNaAkciju_DuplicatePendingPreserved(t *testing.T) {
	db := testPrijaviDB(t)
	user := models.Korisnik{Username: "dup", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Dup", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 5, Javna: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code1, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code1 != http.StatusOK {
		t.Fatalf("first request status %d", code1)
	}
	code2, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code2 != http.StatusBadRequest {
		t.Fatalf("second request status %d", code2)
	}
	if body["error"] != helpers.ErrPendingSignupExists.Error() {
		t.Fatalf("expected pending duplicate error, got %v", body["error"])
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("expected exactly one pending request")
	}
}
