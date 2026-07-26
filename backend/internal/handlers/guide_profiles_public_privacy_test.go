package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testGuidesPublicDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.GuideProfile{},
		&models.GuideTourType{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedApprovedGuideWithContact(t *testing.T, db *gorm.DB) (models.Korisnik, models.GuideProfile) {
	t.Helper()
	lat, lng := 44.8, 20.4
	k := models.Korisnik{
		Username: "pub_guide", Password: "x", Role: "vodic", FullName: "Public Guide",
		Email: "guide-private@example.com", Telefon: "+381600011122",
		AvatarURL: "https://cdn.example/g.jpg",
	}
	if err := db.Create(&k).Error; err != nil {
		t.Fatal(err)
	}
	gp := models.GuideProfile{
		KorisnikID: k.ID, Status: models.GuideStatusApproved,
		Naslov: "Guide Naslov", Opis: "Opis", Grad: "Beograd", Region: "BG", Drzava: "RS",
		BaseLat: &lat, BaseLng: &lng, ProsecnaOcena: 4.9, BrojOcena: 10, BrojVodjenihTura: 5,
		JeziciJSON: json.RawMessage(`["sr","en"]`),
	}
	if err := db.Create(&gp).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.GuideTourType{
		GuideProfileID: gp.ID, Type: models.GuideTourViaFerrata,
	}).Error; err != nil {
		t.Fatal(err)
	}
	return k, gp
}

func assertGuideJSONNoContact(t *testing.T, raw string) {
	t.Helper()
	lower := strings.ToLower(raw)
	for _, key := range []string{`"telefon"`, `"phone"`, `"whatsapp"`, `"email"`} {
		if strings.Contains(lower, key) {
			t.Fatalf("public guide JSON must not contain %s; body=%s", key, raw)
		}
	}
	if strings.Contains(raw, "+381600011122") || strings.Contains(raw, "guide-private@example.com") {
		t.Fatalf("contact values leaked: %s", raw)
	}
}

func callListGuidesCatalog(t *testing.T, db *gorm.DB) (int, string, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/guides?category=all", nil)
	c.Set("db", db)
	ListGuidesCatalog(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, w.Body.String(), body
}

func callListGuidesNearby(t *testing.T, db *gorm.DB) (int, string, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/guides/nearby?lat=44.8&lng=20.4&radius_km=50", nil)
	c.Set("db", db)
	ListGuidesNearby(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, w.Body.String(), body
}

func TestListGuidesCatalog_PublicNoContactFields(t *testing.T) {
	db := testGuidesPublicDB(t)
	_, gp := seedApprovedGuideWithContact(t, db)

	code, raw, body := callListGuidesCatalog(t, db)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}
	assertGuideJSONNoContact(t, raw)

	guides, _ := body["guides"].([]any)
	if len(guides) != 1 {
		t.Fatalf("guides=%v", guides)
	}
	g := guides[0].(map[string]any)
	if int(g["id"].(float64)) != int(gp.ID) {
		t.Fatalf("id=%v", g["id"])
	}
	if g["grad"] != "Beograd" || g["naslov"] != "Guide Naslov" {
		t.Fatalf("public fields missing: %#v", g)
	}
	user, _ := g["user"].(map[string]any)
	if user == nil || user["username"] != "pub_guide" {
		t.Fatalf("user=%v", user)
	}
	if _, ok := user["telefon"]; ok {
		t.Fatal("nested user.telefon must be absent")
	}
	if _, ok := user["email"]; ok {
		t.Fatal("nested user.email must be absent")
	}
}

func TestListGuidesNearby_PublicNoContactFields(t *testing.T) {
	db := testGuidesPublicDB(t)
	seedApprovedGuideWithContact(t, db)

	code, raw, body := callListGuidesNearby(t, db)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}
	assertGuideJSONNoContact(t, raw)
	guides, _ := body["guides"].([]any)
	if len(guides) != 1 {
		t.Fatalf("guides=%v", guides)
	}
	user := guides[0].(map[string]any)["user"].(map[string]any)
	if _, ok := user["telefon"]; ok {
		t.Fatal("nearby nested telefon must be absent")
	}
}

func TestGuideNearbyToPublicDTO_OmitsContact(t *testing.T) {
	lat, lng := 1.0, 2.0
	k := &models.Korisnik{
		ID: 3, Username: "u", FullName: "F", AvatarURL: "a",
		Telefon: "+000", Email: "e@x.com",
	}
	gp := &models.GuideProfile{
		ID: 7, Naslov: "N", Opis: "O", Grad: "G", BaseLat: &lat, BaseLng: &lng,
	}
	dto := guideNearbyToPublicDTO(gp, k, []string{models.GuideTourViaFerrata}, 1.23)
	b, err := json.Marshal(dto)
	if err != nil {
		t.Fatal(err)
	}
	assertGuideJSONNoContact(t, string(b))
	user := dto["user"].(gin.H)
	if _, ok := user["telefon"]; ok {
		t.Fatal("telefon key must not exist")
	}
}

func TestGuideProfileToDTO_OwnerKeepsTelefon(t *testing.T) {
	k := &models.Korisnik{ID: 1, Username: "own", FullName: "Own", Telefon: "+38111", Email: "o@x.com"}
	gp := &models.GuideProfile{ID: 2, Status: models.GuideStatusPending, Naslov: "N"}
	dto := guideProfileToDTO(gp, k, nil, false, true)
	user := dto["user"].(gin.H)
	if user["telefon"] != "+38111" {
		t.Fatalf("owner must keep telefon, got %#v", user["telefon"])
	}
}

func TestGuideProfileToDTO_AdminKeepsTelefon(t *testing.T) {
	k := &models.Korisnik{ID: 1, Username: "g", FullName: "G", Telefon: "+38122", Email: "a@x.com"}
	gp := &models.GuideProfile{ID: 2, Status: models.GuideStatusApproved, Naslov: "N"}
	dto := guideProfileToDTO(gp, k, nil, true, false)
	user := dto["user"].(gin.H)
	if user["telefon"] != "+38122" {
		t.Fatalf("admin must keep telefon, got %#v", user["telefon"])
	}
}

func TestGuideProfileToDTO_NonOwnerNonAdminOmitsTelefon(t *testing.T) {
	k := &models.Korisnik{ID: 1, Username: "g", FullName: "G", Telefon: "+38133", Email: "a@x.com"}
	gp := &models.GuideProfile{ID: 2, Status: models.GuideStatusApproved, Naslov: "N"}
	dto := guideProfileToDTO(gp, k, nil, false, false)
	b, _ := json.Marshal(dto["user"])
	if strings.Contains(string(b), "telefon") {
		t.Fatalf("non-owner/non-admin must omit telefon: %s", b)
	}
}

func TestGetMyGuideProfile_OwnerSeesTelefon(t *testing.T) {
	db := testGuidesPublicDB(t)
	k, gp := seedApprovedGuideWithContact(t, db)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/me/guide-profile", nil)
	c.Set("db", db)
	c.Set("username", k.Username)
	GetMyGuideProfile(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	profile := body["guideProfile"].(map[string]any)
	if int(profile["id"].(float64)) != int(gp.ID) {
		t.Fatalf("profile id=%v", profile["id"])
	}
	user := profile["user"].(map[string]any)
	if user["telefon"] != k.Telefon {
		t.Fatalf("owner telefon=%v want %q", user["telefon"], k.Telefon)
	}
}
