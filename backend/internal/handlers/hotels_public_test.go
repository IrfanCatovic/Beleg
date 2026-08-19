package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testHotelPublicDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(testdb.MemoryDSN(t, "hotels")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Hotel{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func callGetHotelByID(t *testing.T, db *gorm.DB, id uint) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	idStr := strconv.FormatUint(uint64(id), 10)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/hotels/"+idStr, nil)
	c.Params = gin.Params{{Key: "id", Value: idStr}}
	c.Set("db", db)
	GetHotelByID(c)
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, w.Body.String())
	}
	return w.Code, body
}

func TestGetHotelByID_ValidActive(t *testing.T) {
	db := testHotelPublicDB(t)
	h := models.Hotel{
		Naziv:        "Dom na Tari",
		Slug:         "dom-na-tari",
		Lat:          43.9,
		Lng:          19.4,
		Opis:         "Planinarski smeštaj",
		Telefon:      "+381",
		BookingURL:   "https://www.booking.com/hotel/x",
		InstagramURL: "https://www.instagram.com/dom/",
		Status:       "active",
		SlikeJSON:    []byte(`["https://cdn.example/a.jpg"]`),
	}
	if err := db.Create(&h).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callGetHotelByID(t, db, h.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	hotel, _ := body["hotel"].(map[string]any)
	if hotel == nil {
		t.Fatalf("missing hotel: %v", body)
	}
	if hotel["naziv"] != "Dom na Tari" {
		t.Fatalf("naziv=%v", hotel["naziv"])
	}
	for _, k := range []string{"status", "createdAt", "updatedAt", "adminNapomena", "credentials", "billing"} {
		if _, ok := hotel[k]; ok {
			t.Fatalf("public DTO leaked %s", k)
		}
	}
}

func TestGetHotelByID_Missing404(t *testing.T) {
	db := testHotelPublicDB(t)
	code, body := callGetHotelByID(t, db, 999)
	if code != http.StatusNotFound {
		t.Fatalf("want 404, got %d %v", code, body)
	}
	if body["error"] != "Hotel nije pronađen" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestGetHotelByID_DraftNotPublic(t *testing.T) {
	db := testHotelPublicDB(t)
	h := models.Hotel{Naziv: "Draft", Slug: "draft", Lat: 44, Lng: 20, Status: "draft"}
	if err := db.Create(&h).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callGetHotelByID(t, db, h.ID)
	if code != http.StatusNotFound {
		t.Fatalf("draft must 404, got %d", code)
	}
}
