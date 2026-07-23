package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testParticipationDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionParticipationRequest{},
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

func callRespondParticipation(t *testing.T, db *gorm.DB, requestID uint, target models.Korisnik, decision string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]string{"decision": decision})
	c.Request = httptest.NewRequest(http.MethodPost, "/participation/"+strconv.FormatUint(uint64(requestID), 10)+"/respond", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(requestID), 10)}}
	c.Set("db", db)
	c.Set("username", target.Username)
	c.Set(middleware.ContextKeyKorisnik, target)
	RespondToActionParticipationRequest(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestParticipationAccept_CreatesPrijavaAndIzbori(t *testing.T) {
	db := testParticipationDB(t)
	klubID := uint(1)
	admin := models.Korisnik{Username: "adm_p", Password: "x", Role: "admin", KlubID: &klubID}
	target := models.Korisnik{Username: "tgt_p", Password: "x", Role: "clan", KlubID: &klubID}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&target).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		UkupnoKmAkcija: 3, UkupnoMetaraUsponaAkcija: 200, KlubID: &klubID, VodicID: admin.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	req := models.ActionParticipationRequest{
		AkcijaID: akcija.ID, TargetUserID: target.ID, RequestedByID: admin.ID,
		Status: models.ActionParticipationRequestPending,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callRespondParticipation(t, db, req.ID, target, "accept")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	var prijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, target.ID).First(&prijava).Error; err != nil {
		t.Fatal(err)
	}
	if prijava.Status != "popeo se" {
		t.Fatalf("status=%q", prijava.Status)
	}
	var n int64
	db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", prijava.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected 1 PrijavaIzbori, got %d", n)
	}
	var updated models.ActionParticipationRequest
	if err := db.First(&updated, req.ID).Error; err != nil {
		t.Fatal(err)
	}
	if updated.Status != models.ActionParticipationRequestAccepted {
		t.Fatalf("request status=%q", updated.Status)
	}
}

func TestParticipationAccept_IzboriFailure_RollsBack(t *testing.T) {
	db := testParticipationDB(t)
	klubID := uint(2)
	admin := models.Korisnik{Username: "adm_r", Password: "x", Role: "admin", KlubID: &klubID}
	target := models.Korisnik{Username: "tgt_r", Password: "x", Role: "clan", KlubID: &klubID}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&target).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		UkupnoKmAkcija: 3, UkupnoMetaraUsponaAkcija: 200, KlubID: &klubID, VodicID: admin.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	req := models.ActionParticipationRequest{
		AkcijaID: akcija.ID, TargetUserID: target.ID, RequestedByID: admin.ID,
		Status: models.ActionParticipationRequestPending,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}

	cbName := "fail_part_izbori_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:before_create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "prijava_izbori" {
			_ = tx.AddError(errors.New("forced izbori failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	code, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	var nPrijava int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, target.ID).Count(&nPrijava)
	if nPrijava != 0 {
		t.Fatal("prijava must roll back")
	}
	var updated models.ActionParticipationRequest
	if err := db.First(&updated, req.ID).Error; err != nil {
		t.Fatal(err)
	}
	if updated.Status != models.ActionParticipationRequestPending {
		t.Fatalf("request must stay pending, got %q", updated.Status)
	}
	u := models.Korisnik{}
	if err := db.First(&u, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if u.BrojPopeoSe != 0 {
		t.Fatal("stats must roll back")
	}
}
