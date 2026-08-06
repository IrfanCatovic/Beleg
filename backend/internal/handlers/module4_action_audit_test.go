package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testModule4DB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Klubovi{},
		&models.Korisnik{},
		&models.Block{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionSignupRequest{},
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

func m4Club(t *testing.T, db *gorm.DB, name string) models.Klubovi {
	t.Helper()
	k := models.Klubovi{Naziv: name}
	if err := db.Create(&k).Error; err != nil {
		t.Fatal(err)
	}
	return k
}

func m4User(t *testing.T, db *gorm.DB, username, role string, clubID *uint) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: role, FullName: username, KlubID: clubID}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func m4Akcija(t *testing.T, db *gorm.DB, clubID uint, guideID uint, javna bool) models.Akcija {
	t.Helper()
	a := models.Akcija{
		Naziv:          "M4 akcija",
		Datum:          time.Now().UTC().Add(72 * time.Hour),
		Javna:          javna,
		MaxLjudi:       10,
		KlubID:         &clubID,
		VodicID:        guideID,
		AddedByID:      guideID,
		OrganizatorTip: "klub",
		UIstorijiKluba: true,
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func m4ManageCtx(t *testing.T, db *gorm.DB, user models.Korisnik, method, path string, body []byte) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if body != nil {
		c.Request = httptest.NewRequest(method, path, bytes.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
	} else {
		c.Request = httptest.NewRequest(method, path, nil)
	}
	c.Set("db", db)
	c.Set(middleware.ContextKeyKorisnik, user)
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	return w, c
}

// Actual behavior: block between viewer and guide does not block apply.
func TestModule4_Block_ViewerBlockedGuide_ApplyStillAllowed_Documented(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_block")
	guide := m4User(t, db, "m4_guide", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_viewer", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: guide.ID}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusOK {
		t.Fatalf("documented actual: apply succeeds despite block; got %d %v", code, body)
	}
}

// Expected global block parity (fails until actions honor viewer↔guide block).
func TestModule4_Block_ExpectedDenyApply_DocumentedGap(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_block2")
	guide := m4User(t, db, "m4_guide2", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_viewer2", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: guide.ID}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code == http.StatusOK {
		t.Fatalf("M4-BLOCK-1 P2: viewer blocked guide but apply succeeded (expected deny for global block parity)")
	}
}

func TestModule4_ParticipantListDTO_NoEmailPhone(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_priv")
	admin := m4User(t, db, "m4_admin", "admin", &club.ID)
	member := m4User(t, db, "m4_member", "clan", &club.ID)
	if err := db.Model(&member).Updates(map[string]any{
		"email":   "secret@example.com",
		"telefon": "061999",
		"adresa":  "ulica 9",
	}).Error; err != nil {
		t.Fatal(err)
	}
	akcija := m4Akcija(t, db, club.ID, admin.ID, true)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	id := strconv.FormatUint(uint64(akcija.ID), 10)
	w, c := m4ManageCtx(t, db, admin, http.MethodGet, "/api/akcije/"+id+"/prijave", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	GetPrijaveZaAkciju(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
	raw := strings.ToLower(w.Body.String())
	for _, leak := range []string{"secret@example.com", "061999", "ulica 9"} {
		if strings.Contains(raw, strings.ToLower(leak)) {
			t.Fatalf("prijave DTO leaked %q in %s", leak, w.Body.String())
		}
	}
}

func TestModule4_CancelledAction_SignupRejected(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_cancel")
	admin := m4User(t, db, "m4_c_admin", "admin", &club.ID)
	viewer := m4User(t, db, "m4_c_viewer", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, admin.ID, true)
	if err := db.Model(&akcija).Updates(map[string]any{"is_cancelled": true}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code < 400 {
		t.Fatalf("cancelled action must reject signup, got %d %v", code, body)
	}
}

func TestModule4_CancelledAction_StatusChangeRejected(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_cancel2")
	admin := m4User(t, db, "m4_c2_admin", "admin", &club.ID)
	member := m4User(t, db, "m4_c2_mem", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, admin.ID, true)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&akcija).Updates(map[string]any{"is_cancelled": true}).Error; err != nil {
		t.Fatal(err)
	}

	body, _ := json.Marshal(map[string]string{"status": "popeo se"})
	pid := strconv.FormatUint(uint64(p.ID), 10)
	w, c := m4ManageCtx(t, db, admin, http.MethodPost, "/api/prijave/"+pid+"/status", body)
	c.Params = gin.Params{{Key: "id", Value: pid}}
	UpdatePrijavaStatus(c)
	if w.Code != http.StatusConflict && w.Code < 400 {
		t.Fatalf("cancelled action must block popeo-se mark, got %d %s", w.Code, w.Body.String())
	}
}

func TestModule4_PublicDetail_CancelledStillReadable(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_pub")
	admin := m4User(t, db, "m4_pub_admin", "admin", &club.ID)
	akcija := m4Akcija(t, db, club.ID, admin.ID, true)
	if err := db.Model(&akcija).Updates(map[string]any{"is_cancelled": true}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("cancelled public detail want 200 got %d", code)
	}
	if body["isCancelled"] != true {
		t.Fatalf("isCancelled want true got %v", body["isCancelled"])
	}
}

func TestModule4_PrivateDetail_OutsiderLimited(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_priv2")
	admin := m4User(t, db, "m4_priv_admin", "admin", &club.ID)
	akcija := m4Akcija(t, db, club.ID, admin.ID, false)

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if body["limited"] != true {
		t.Fatalf("outsider private detail must be limited, body=%v", body)
	}
	if _, ok := body["kontaktTelefon"]; ok {
		t.Fatal("limited must not include kontaktTelefon")
	}
	if _, ok := body["opis"]; ok {
		t.Fatal("limited must not include opis")
	}
}

func TestModule4_DuplicatePendingSignup_SameUser(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_dup")
	admin := m4User(t, db, "m4_dup_admin", "admin", &club.ID)
	viewer := m4User(t, db, "m4_dup_viewer", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, admin.ID, true)

	code1, body1 := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code1 != http.StatusOK {
		t.Fatalf("first apply failed %d %v", code1, body1)
	}
	code2, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code2 < 400 {
		t.Fatalf("second pending apply must fail, got %d", code2)
	}
	var cnt int64
	if err := db.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND requester_id = ? AND status = ?", akcija.ID, viewer.ID, models.ActionSignupRequestPending).
		Count(&cnt).Error; err != nil {
		t.Fatal(err)
	}
	if cnt != 1 {
		t.Fatalf("pending signup rows want 1 got %d", cnt)
	}
}

func TestModule4_UniquePrijavaConstraint_OneActiveRow(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_uq")
	admin := m4User(t, db, "m4_uq_admin", "admin", &club.ID)
	member := m4User(t, db, "m4_uq_mem", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, admin.ID, true)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}).Error
	if err == nil {
		t.Fatal("expected unique (akcija_id, korisnik_id) to reject second prijava")
	}
}

func TestModule4_OtherClubAdmin_CannotMarkPopeoSe(t *testing.T) {
	db := testModule4DB(t)
	clubA := m4Club(t, db, "m4_club_a")
	clubB := m4Club(t, db, "m4_club_b")
	adminA := m4User(t, db, "m4_admin_a", "admin", &clubA.ID)
	adminB := m4User(t, db, "m4_admin_b", "admin", &clubB.ID)
	member := m4User(t, db, "m4_mem_a", "clan", &clubA.ID)
	akcija := m4Akcija(t, db, clubA.ID, adminA.ID, true)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	body, _ := json.Marshal(map[string]string{"status": "popeo se"})
	pid := strconv.FormatUint(uint64(p.ID), 10)
	w, c := m4ManageCtx(t, db, adminB, http.MethodPost, "/api/prijave/"+pid+"/status", body)
	c.Params = gin.Params{{Key: "id", Value: pid}}
	UpdatePrijavaStatus(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("other club admin must get 403, got %d %s", w.Code, w.Body.String())
	}
}
