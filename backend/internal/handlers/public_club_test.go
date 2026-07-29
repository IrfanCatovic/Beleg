package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPublicClubDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "public_club")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Klubovi{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func assertNoPrivatePublicClubKeys(t *testing.T, raw string) {
	t.Helper()
	forbidden := []string{
		`"email"`, `"telefon"`, `"adresa"`, `"pib"`, `"maticni_broj"`, `"ziro_racun"`,
		`"members"`, `"roles"`, `"invite"`, `"InviteCode"`, `"korisnik_limit"`,
		`"max_storage_gb"`, `"used_storage_gb"`, `"subscribedAt"`, `"subscriptionEndsAt"`,
		`"onHold"`, `"createdAt"`, `"updatedAt"`, `"valuta"`,
	}
	for _, key := range forbidden {
		if strings.Contains(raw, key) {
			t.Fatalf("public JSON must not contain %s; body=%s", key, raw)
		}
	}
}

func seedPublicClubs(t *testing.T, db *gorm.DB) (active, held, dupA, dupB models.Klubovi) {
	t.Helper()
	founded := time.Date(1990, 5, 1, 0, 0, 0, 0, time.UTC)
	active = models.Klubovi{
		Naziv: "Demo Klub", LogoURL: "https://cdn.example/logo.png", Sediste: "Sarajevo",
		WebSajt: "https://demo.example", DatumOsnivanja: founded,
		Adresa: "Tajna 1", Telefon: "+38761111", Email: "secret@example.com",
		PIB: "123", MaticniBroj: "456", ZiroRacun: "789", OnHold: false,
	}
	held = models.Klubovi{
		Naziv: "Paused Klub", Email: "hold@example.com", Telefon: "+1", OnHold: true,
	}
	dupA = models.Klubovi{Naziv: "Duplikat", Email: "a@x.com", OnHold: false}
	dupB = models.Klubovi{Naziv: "Duplikat", Email: "b@x.com", OnHold: false}
	for _, k := range []*models.Klubovi{&active, &held, &dupA, &dupB} {
		if err := db.Create(k).Error; err != nil {
			t.Fatal(err)
		}
	}
	return active, held, dupA, dupB
}

func TestPublicKluboviList_SafeDTOOnly(t *testing.T) {
	db := testPublicClubDB(t)
	active, _, _, _ := seedPublicClubs(t, db)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/klubovi", nil)
	GetPublicKluboviList(db)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	raw := w.Body.String()
	assertNoPrivatePublicClubKeys(t, raw)

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	list, _ := body["klubovi"].([]any)
	if len(list) != 3 { // active + 2 duplicates; held excluded
		t.Fatalf("expected 3 public clubs, got %d body=%s", len(list), raw)
	}
	first, _ := list[0].(map[string]any)
	if _, ok := first["id"]; !ok {
		t.Fatal("id required")
	}
	_ = active
}

func TestPublicKlubByNaziv_SafeDTOAndSpecialChars(t *testing.T) {
	db := testPublicClubDB(t)
	special := models.Klubovi{
		Naziv: "Šar Planina", Sediste: "Tetovo", WebSajt: "planina.example",
		Email: "nope@x.com", Telefon: "hidden", Adresa: "hidden",
	}
	if err := db.Create(&special).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "naziv", Value: "Šar Planina"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/klubovi/"+url.PathEscape("Šar Planina"), nil)
	GetPublicKlubByNaziv(db)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	raw := w.Body.String()
	assertNoPrivatePublicClubKeys(t, raw)
	if !strings.Contains(raw, `"naziv":"Šar Planina"`) && !strings.Contains(raw, `"naziv":"\u0160ar Planina"`) {
		t.Fatalf("expected special naziv in body=%s", raw)
	}
}

func TestPublicKlubByID_SafeDTO(t *testing.T) {
	db := testPublicClubDB(t)
	active, _, _, _ := seedPublicClubs(t, db)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(active.ID), 10)}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/klubovi/id/"+strconv.FormatUint(uint64(active.ID), 10), nil)
	GetPublicKlubByID(db)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	raw := w.Body.String()
	assertNoPrivatePublicClubKeys(t, raw)

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	klub, _ := body["klub"].(map[string]any)
	if int(klub["id"].(float64)) != int(active.ID) {
		t.Fatalf("id mismatch: %#v", klub)
	}
	if klub["naziv"] != "Demo Klub" {
		t.Fatalf("naziv=%v", klub["naziv"])
	}
	if _, ok := klub["email"]; ok {
		t.Fatal("email leaked")
	}
}

func TestPublicKlubByID_InvalidAndMissing(t *testing.T) {
	db := testPublicClubDB(t)
	_, _, _, _ = seedPublicClubs(t, db)

	cases := []struct {
		id   string
		code int
	}{
		{"0", http.StatusBadRequest},
		{"-1", http.StatusBadRequest},
		{"abc", http.StatusBadRequest},
		{"999999", http.StatusNotFound},
	}
	for _, tc := range cases {
		gin.SetMode(gin.TestMode)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: tc.id}}
		c.Request = httptest.NewRequest(http.MethodGet, "/api/klubovi/id/"+tc.id, nil)
		GetPublicKlubByID(db)(c)
		if w.Code != tc.code {
			t.Fatalf("id=%s got %d want %d body=%s", tc.id, w.Code, tc.code, w.Body.String())
		}
	}
}

func TestPublicKlub_OnHoldIsNotFound(t *testing.T) {
	db := testPublicClubDB(t)
	_, held, _, _ := seedPublicClubs(t, db)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(held.ID), 10)}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/klubovi/id/"+strconv.FormatUint(uint64(held.ID), 10), nil)
	GetPublicKlubByID(db)(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("onHold by id status=%d body=%s", w.Code, w.Body.String())
	}

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Params = gin.Params{{Key: "naziv", Value: held.Naziv}}
	c2.Request = httptest.NewRequest(http.MethodGet, "/api/klubovi/"+url.PathEscape(held.Naziv), nil)
	GetPublicKlubByNaziv(db)(c2)
	if w2.Code != http.StatusNotFound {
		t.Fatalf("onHold by name status=%d body=%s", w2.Code, w2.Body.String())
	}
}

func TestPublicKlubByID_IgnoresDuplicateNames(t *testing.T) {
	db := testPublicClubDB(t)
	_, _, dupA, dupB := seedPublicClubs(t, db)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(dupB.ID), 10)}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/klubovi/id/"+strconv.FormatUint(uint64(dupB.ID), 10), nil)
	GetPublicKlubByID(db)(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d", w.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	klub, _ := body["klub"].(map[string]any)
	if int(klub["id"].(float64)) != int(dupB.ID) {
		t.Fatalf("expected dupB id=%d got %#v (dupA=%d)", dupB.ID, klub, dupA.ID)
	}
}

func TestGetMojKlub_StillReturnsInternalFields(t *testing.T) {
	db := testPublicClubDB(t)
	active, _, _, _ := seedPublicClubs(t, db)
	user := models.Korisnik{
		Username: "member_pub", Password: "x", Role: "clan", KlubID: &active.ID,
	}
	if err := db.AutoMigrate(&models.Korisnik{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/klub", nil)
	c.Set("db", db)
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	c.Set("klubId", active.ID)
	GetMojKlub(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	raw := w.Body.String()
	for _, key := range []string{`"email"`, `"telefon"`, `"adresa"`, `"pib"`} {
		if !strings.Contains(raw, key) {
			t.Fatalf("own-club response should still include %s; body=%s", key, raw)
		}
	}
}

