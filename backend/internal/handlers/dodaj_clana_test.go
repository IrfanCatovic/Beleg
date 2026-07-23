package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testDodajClanaDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}, &models.Akcija{}, &models.Prijava{}, &models.Obavestenje{}); err != nil {
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

func callDodajClanaPopeoSe(t *testing.T, db *gorm.DB, akcijaID uint, targetUserID uint, callerUsername, callerRole string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]any{"korisnikId": targetUserID})
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/dodaj-clana", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", callerUsername)
	c.Set("role", callerRole)
	DodajClanaPopeoSe(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestDodajClanaPopeoSe_UnauthorizedNoChange(t *testing.T) {
	db := testDodajClanaDB(t)
	klubID := uint(1)
	admin := models.Korisnik{Username: "admin1", Password: "x", Role: "admin", KlubID: &klubID}
	outsider := models.Korisnik{Username: "outsider", Password: "x", Role: "clan", KlubID: &klubID}
	member := models.Korisnik{Username: "member1", Password: "x", Role: "clan", KlubID: &klubID}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&outsider).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}
	otherKlub := uint(2)
	akcija := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		UkupnoKmAkcija: 5, UkupnoMetaraUsponaAkcija: 100, KlubID: &otherKlub,
		VodicID: admin.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	// outsider nije admin/vodič kluba domaćina ni vođa akcije
	code, body := callDodajClanaPopeoSe(t, db, akcija.ID, member.ID, outsider.Username, outsider.Role)
	if code != http.StatusForbidden {
		t.Fatalf("status=%d body=%v", code, body)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ?", akcija.ID).Count(&n)
	if n != 0 {
		t.Fatal("unauthorized must not create prijava")
	}
}

func TestDodajClanaPopeoSe_AlreadySummitedConflict(t *testing.T) {
	db := testDodajClanaDB(t)
	klubID := uint(3)
	admin := models.Korisnik{Username: "adm", Password: "x", Role: "admin", KlubID: &klubID}
	member := models.Korisnik{Username: "mem", Password: "x", Role: "clan", KlubID: &klubID}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		UkupnoKmAkcija: 5, UkupnoMetaraUsponaAkcija: 100, KlubID: &klubID, VodicID: admin.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "popeo se"}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callDodajClanaPopeoSe(t, db, akcija.ID, member.ID, admin.Username, admin.Role)
	if code != http.StatusConflict {
		t.Fatalf("status=%d body=%v", code, body)
	}
}
