package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPublicProfileDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "public_profile")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}, &models.GuideProfile{}, &models.Block{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func callGetPublicKorisnik(t *testing.T, db *gorm.DB, param string, viewer *models.Korisnik) (int, map[string]any, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/korisnici/"+param, nil)
	c.Set("db", db)
	c.Params = gin.Params{{Key: "id", Value: param}}
	if viewer != nil {
		c.Set(middleware.ContextKeyKorisnik, *viewer)
	}
	GetPublicKorisnik(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body, w.Body.String()
}

func TestGetPublicKorisnik_ByIDAndUsername(t *testing.T) {
	db := testPublicProfileDB(t)
	u := models.Korisnik{
		Username: "alice_pub", Password: "x", Role: "clan", FullName: "Alice",
		Email: "secret@example.com", Telefon: "+381600000000", Adresa: "Secret St",
		BrojLicnogDokumenta: "DOC-SECRET", Napomene: "internal",
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	for _, param := range []string{"1", "alice_pub"} {
		code, body, raw := callGetPublicKorisnik(t, db, param, nil)
		if code != http.StatusOK {
			t.Fatalf("param=%s status %d", param, code)
		}
		if body["username"] != "alice_pub" {
			t.Fatalf("username=%v", body["username"])
		}
		forbidden := []string{`"email"`, `"telefon"`, `"adresa"`, `"password"`, `"napomene"`, `"broj_licnog_dokumenta"`}
		for _, f := range forbidden {
			if strings.Contains(raw, f) {
				t.Errorf("param=%s leaked %s in %s", param, f, raw)
			}
		}
	}
}

func TestGetPublicKorisnik_DeletedUser404(t *testing.T) {
	db := testPublicProfileDB(t)
	u := models.Korisnik{Username: "gone", Password: "x", Role: "deleted"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	code, body, _ := callGetPublicKorisnik(t, db, "gone", nil)
	if code != http.StatusNotFound {
		t.Fatalf("status %d", code)
	}
	if body["error"] != "Korisnik nije pronađen" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestGetPublicKorisnik_MissingUserSameAsDeleted(t *testing.T) {
	db := testPublicProfileDB(t)
	code, body, _ := callGetPublicKorisnik(t, db, "99999", nil)
	if code != http.StatusNotFound {
		t.Fatalf("status %d", code)
	}
	if body["error"] != "Korisnik nije pronađen" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestGetPublicKorisnik_BlockerGets404ByID(t *testing.T) {
	db := testPublicProfileDB(t)
	alice := models.Korisnik{Username: "alice", Password: "x", Role: "clan"}
	bob := models.Korisnik{Username: "bob", Password: "x", Role: "clan"}
	if err := db.Create(&alice).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&bob).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, body, raw := callGetPublicKorisnik(t, db, strconv.FormatUint(uint64(alice.ID), 10), &bob)
	_ = raw
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%s", code, raw)
	}
	if body["error"] != "Korisnik nije pronađen" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestGetPublicKorisnik_BlockedGets404ByID(t *testing.T) {
	db := testPublicProfileDB(t)
	alice := models.Korisnik{Username: "alice", Password: "x", Role: "clan"}
	bob := models.Korisnik{Username: "bob", Password: "x", Role: "clan"}
	if err := db.Create(&alice).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&bob).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, body, _ := callGetPublicKorisnik(t, db, strconv.FormatUint(uint64(bob.ID), 10), &alice)
	if code != http.StatusNotFound {
		t.Fatalf("status %d", code)
	}
	if body["error"] != "Korisnik nije pronađen" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestGetPublicKorisnik_BlockReturns404ByUsername(t *testing.T) {
	db := testPublicProfileDB(t)
	alice := models.Korisnik{Username: "alice", Password: "x", Role: "clan"}
	bob := models.Korisnik{Username: "bob", Password: "x", Role: "clan"}
	if err := db.Create(&alice).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&bob).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, _, _ := callGetPublicKorisnik(t, db, "bob", &alice)
	if code != http.StatusNotFound {
		t.Fatalf("status %d", code)
	}
	code2, _, _ := callGetPublicKorisnik(t, db, "alice", &bob)
	if code2 != http.StatusNotFound {
		t.Fatalf("reverse status %d", code2)
	}
}

func TestGetPublicKorisnik_LoggedOutIgnoresBlock(t *testing.T) {
	db := testPublicProfileDB(t)
	alice := models.Korisnik{Username: "alice", Password: "x", Role: "clan"}
	bob := models.Korisnik{Username: "bob", Password: "x", Role: "clan"}
	if err := db.Create(&alice).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&bob).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, body, _ := callGetPublicKorisnik(t, db, "alice", nil)
	if code != http.StatusOK {
		t.Fatalf("logged-out status %d", code)
	}
	if body["username"] != "alice" {
		t.Fatalf("username=%v", body["username"])
	}
}

func TestGetPublicKorisnik_OwnProfileNotBlocked(t *testing.T) {
	db := testPublicProfileDB(t)
	alice := models.Korisnik{Username: "alice", Password: "x", Role: "clan"}
	if err := db.Create(&alice).Error; err != nil {
		t.Fatal(err)
	}
	code, body, _ := callGetPublicKorisnik(t, db, "alice", &alice)
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if body["username"] != "alice" {
		t.Fatalf("username=%v", body["username"])
	}
}

func TestBuildPublicUserDTO_NoPrivateFields(t *testing.T) {
	u := models.Korisnik{
		Username: "dto", FullName: "DTO", Role: "clan",
		Email: "e@x.com", Telefon: "+1", Adresa: "addr",
		BrojLicnogDokumenta: "doc", Napomene: "note",
	}
	dto := BuildPublicUserDTO(u, false)
	raw, _ := json.Marshal(dto)
	s := string(raw)
	for _, forbidden := range []string{"email", "telefon", "adresa", "password", "napomene", "broj_licnog"} {
		if strings.Contains(s, forbidden) {
			t.Fatalf("PublicUserDTO leaked %s: %s", forbidden, s)
		}
	}
}

func TestFollowUserDTO_NoPrivateFields(t *testing.T) {
	u := models.Korisnik{
		Username: "f", FullName: "F", Role: "clan",
		Email: "e@x.com", Telefon: "+1",
	}
	dto := toFollowUserDTO(u, nil)
	raw, _ := json.Marshal(dto)
	s := string(raw)
	if strings.Contains(s, "email") || strings.Contains(s, "telefon") {
		t.Fatalf("FollowUserDTO leaked private fields: %s", s)
	}
}
