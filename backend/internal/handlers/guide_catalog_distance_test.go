package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testGuideCatalogDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(testdb.MemoryDSN(t, "guides")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}, &models.GuideProfile{}, &models.GuideTourType{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedApprovedGuide(t *testing.T, db *gorm.DB, username string, lat, lng *float64) models.GuideProfile {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "vodic", FullName: username}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	gp := models.GuideProfile{
		KorisnikID: u.ID,
		Status:     models.GuideStatusApproved,
		Naslov:     username,
		Opis:       "opis",
		BaseLat:    lat,
		BaseLng:    lng,
	}
	if err := db.Create(&gp).Error; err != nil {
		t.Fatal(err)
	}
	return gp
}

func callListGuidesCatalogQuery(t *testing.T, db *gorm.DB, rawQuery string) (int, []map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/guides"+rawQuery, nil)
	c.Set("db", db)
	ListGuidesCatalog(c)
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, w.Body.String())
	}
	raw, _ := body["guides"].([]any)
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		m, _ := item.(map[string]any)
		out = append(out, m)
	}
	return w.Code, out
}

func TestListGuidesCatalog_OmitsFakeZeroDistance(t *testing.T) {
	db := testGuideCatalogDB(t)
	lat, lng := 43.8563, 18.4131
	seedApprovedGuide(t, db, "far", &lat, &lng)
	code, guides := callListGuidesCatalogQuery(t, db, "?category=all")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if len(guides) != 1 {
		t.Fatalf("guides=%d", len(guides))
	}
	if _, ok := guides[0]["distanceKm"]; ok {
		t.Fatalf("catalog without origin must omit distanceKm, got %v", guides[0]["distanceKm"])
	}
}

func TestListGuidesCatalog_WithOriginComputesRealDistance(t *testing.T) {
	db := testGuideCatalogDB(t)
	nearLat, nearLng := 44.7866, 20.575
	farLat, farLng := 43.8563, 18.4131
	seedApprovedGuide(t, db, "near", &nearLat, &nearLng)
	seedApprovedGuide(t, db, "far", &farLat, &farLng)
	seedApprovedGuide(t, db, "nocoords", nil, nil)

	code, guides := callListGuidesCatalogQuery(t, db, "?category=all&lat=44.7866&lng=20.4489")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if len(guides) != 3 {
		t.Fatalf("guides=%d", len(guides))
	}
	if guides[0]["naslov"] != "near" {
		t.Fatalf("expected near first, got %v", guides[0]["naslov"])
	}
	nearKm, _ := guides[0]["distanceKm"].(float64)
	if nearKm < 8 || nearKm > 12 {
		t.Fatalf("near km=%v", nearKm)
	}
	farKm, _ := guides[1]["distanceKm"].(float64)
	if farKm < 100 {
		t.Fatalf("far km=%v must not be 0", farKm)
	}
	if _, ok := guides[2]["distanceKm"]; ok {
		t.Fatalf("unknown coords must omit distanceKm")
	}
	if guides[2]["naslov"] != "nocoords" {
		t.Fatalf("unknown should sort last, got %v", guides[2]["naslov"])
	}
}
