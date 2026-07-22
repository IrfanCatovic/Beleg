package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testCancellationReadDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Klubovi{},
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionSignupRequest{},
		&models.ActionInviteLink{},
		&models.AkcijaSmestaj{},
		&models.AkcijaPrevoz{},
		&models.AkcijaOprema{},
		&models.AkcijaOpremaRent{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}

func assertCancellationFields(t *testing.T, body map[string]any, wantCancelled bool, wantReason string, wantAt *time.Time) {
	t.Helper()
	gotCancelled, ok := body["isCancelled"].(bool)
	if !ok {
		t.Fatalf("isCancelled missing or wrong type: %v", body["isCancelled"])
	}
	if gotCancelled != wantCancelled {
		t.Fatalf("isCancelled=%v want %v", gotCancelled, wantCancelled)
	}

	if wantAt == nil {
		if v, exists := body["cancelledAt"]; exists && v != nil {
			t.Fatalf("cancelledAt want null/absent, got %v", v)
		}
	} else {
		raw, ok := body["cancelledAt"].(string)
		if !ok || raw == "" {
			t.Fatalf("cancelledAt missing/invalid: %v", body["cancelledAt"])
		}
		parsed, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			parsed, err = time.Parse(time.RFC3339, raw)
		}
		if err != nil {
			t.Fatalf("cancelledAt parse: %v raw=%q", err, raw)
		}
		if !parsed.Equal(wantAt.UTC()) && !parsed.Equal(*wantAt) {
			// Allow minor timezone representation differences if instants match.
			if parsed.Unix() != wantAt.Unix() {
				t.Fatalf("cancelledAt=%v want %v", parsed, *wantAt)
			}
		}
	}

	if wantReason == "" {
		if v, exists := body["cancellationReason"]; exists {
			if s, ok := v.(string); ok && s != "" {
				t.Fatalf("cancellationReason want empty/absent, got %q", s)
			}
		}
	} else if body["cancellationReason"] != wantReason {
		t.Fatalf("cancellationReason=%v want %q", body["cancellationReason"], wantReason)
	}
}

func TestGetPublicAkcijaByID_ActiveDefaultsCancellationFields(t *testing.T) {
	db := testCancellationReadDB(t)
	akcija := createPublicAkcija(t, db, 5)

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["isCompleted"] != false {
		t.Fatalf("isCompleted=%v", body["isCompleted"])
	}
	assertCancellationFields(t, body, false, "", nil)
	if _, ok := body["id"]; !ok {
		t.Fatal("existing fields must remain (id)")
	}
	if _, ok := body["naziv"]; !ok {
		t.Fatal("existing fields must remain (naziv)")
	}
}

func TestGetPublicAkcijaByID_ReturnsStoredCancellationFields(t *testing.T) {
	db := testCancellationReadDB(t)
	at := time.Date(2026, 7, 20, 9, 30, 0, 0, time.UTC)
	akcija := models.Akcija{
		Naziv:              "Otkazana",
		Datum:              time.Now().Add(72 * time.Hour),
		Javna:              true,
		MaxLjudi:           8,
		IsCancelled:        true,
		CancelledAt:        &at,
		CancellationReason: "Loši vremenski uslovi",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	assertCancellationFields(t, body, true, "Loši vremenski uslovi", &at)
}

func TestGetPublicAkcijaByID_LimitedIncludesCancellationLifecycle(t *testing.T) {
	db := testCancellationReadDB(t)
	at := time.Date(2026, 7, 21, 15, 0, 0, 0, time.UTC)
	akcija := models.Akcija{
		Naziv:              "Private cancelled",
		Datum:              time.Now().Add(72 * time.Hour),
		Javna:              false,
		IsCancelled:        true,
		CancelledAt:        &at,
		CancellationReason: "Nedovoljno prijava",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["limited"] != true {
		t.Fatalf("expected limited, got %v", body)
	}
	assertCancellationFields(t, body, true, "Nedovoljno prijava", &at)
	if _, ok := body["prijaveCount"]; ok {
		t.Fatal("limited must not include prijaveCount")
	}
	if _, ok := body["maxLjudi"]; ok {
		t.Fatal("limited must not include maxLjudi")
	}
	if _, ok := body["cenaClan"]; ok {
		t.Fatal("limited must not include cenaClan")
	}
}

func TestGetAkcije_ListIncludesCancellationFields(t *testing.T) {
	db := testCancellationReadDB(t)
	akcija := models.Akcija{
		Naziv: "List active",
		Datum: time.Now().Add(48 * time.Hour),
		Javna: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/akcije", nil)
	c.Set("db", db)
	c.Set("username", "nobody")
	c.Set("role", "clan")
	GetAkcije(c)

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body=%v", w.Code, body)
	}
	aktivne, ok := body["aktivne"].([]any)
	if !ok || len(aktivne) == 0 {
		t.Fatalf("aktivne empty: %v", body["aktivne"])
	}
	row, ok := aktivne[0].(map[string]any)
	if !ok {
		t.Fatalf("aktivne[0] type %T", aktivne[0])
	}
	assertCancellationFields(t, row, false, "", nil)
}

func TestCreateAkcija_JSONHasIsCancelledFalse(t *testing.T) {
	db := testCancellationReadDB(t)
	akcija := models.Akcija{
		Naziv: "Nova",
		Datum: time.Now().Add(48 * time.Hour),
		Javna: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	var loaded models.Akcija
	if err := db.First(&loaded, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(gin.H{"message": "Akcija dodata", "akcija": loaded})
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	akcijaObj, ok := body["akcija"].(map[string]any)
	if !ok {
		t.Fatalf("akcija payload missing: %v", body)
	}
	assertCancellationFields(t, akcijaObj, false, "", nil)
}

func TestExecuteUpdateAkcijaTx_CancelledBlocked(t *testing.T) {
	db := testCancellationReadDB(t)
	at := time.Date(2026, 7, 18, 11, 0, 0, 0, time.UTC)
	akcija := models.Akcija{
		Naziv:              "Keep cancel",
		Planina:            "A",
		Vrh:                "B",
		Datum:              time.Now().Add(48 * time.Hour),
		Tezina:             "srednje",
		Javna:              true,
		IsCancelled:        true,
		CancelledAt:        &at,
		CancellationReason: "Original reason",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	mutated := akcija
	mutated.Naziv = "Renamed"
	mutated.IsCancelled = false
	mutated.CancelledAt = nil
	mutated.CancellationReason = "hacked"

	err := db.Transaction(func(tx *gorm.DB) error {
		return executeUpdateAkcijaTx(tx, mutated, ActionNestedSyncInput{})
	})
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("expected ErrAkcijaCancelled, got %v", err)
	}

	var saved models.Akcija
	if err := db.First(&saved, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.Naziv != "Keep cancel" {
		t.Fatalf("naziv must stay unchanged, got %q", saved.Naziv)
	}
	if !saved.IsCancelled || saved.CancellationReason != "Original reason" {
		t.Fatalf("cancellation fields must stay: %+v", saved)
	}
}

func TestUpdateAkcija_FormCancellationFieldsIgnored(t *testing.T) {
	db := testCancellationReadDB(t)
	at := time.Date(2026, 7, 17, 7, 0, 0, 0, time.UTC)
	owner := models.Korisnik{Username: "cancel_owner", Password: "x", Role: "admin"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv:                    "Form ignore",
		Planina:                  "Planina",
		Vrh:                      "Vrh",
		Datum:                    time.Now().Add(72 * time.Hour),
		Tezina:                   "lako",
		Javna:                    true,
		VodicID:                  owner.ID,
		AddedByID:                owner.ID,
		UkupnoMetaraUsponaAkcija: 100,
		UkupnoKmAkcija:           5,
		IsCancelled:              true,
		CancelledAt:              &at,
		CancellationReason:       "Keep me",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("naziv", "Form ignore")
	_ = w.WriteField("planina", "Planina")
	_ = w.WriteField("vrh", "Vrh")
	_ = w.WriteField("datum", akcija.Datum.Format("2006-01-02"))
	_ = w.WriteField("tezina", "lako")
	_ = w.WriteField("kumulativniUsponM", "100")
	_ = w.WriteField("duzinaStazeKm", "5")
	_ = w.WriteField("planinaLat", "42.44")
	_ = w.WriteField("planinaLng", "19.26")
	_ = w.WriteField("tipAkcije", "planina")
	_ = w.WriteField("vodic_id", strconv.FormatUint(uint64(owner.ID), 10))
	_ = w.WriteField("isCancelled", "false")
	_ = w.WriteField("cancellationReason", "should not apply")
	_ = w.WriteField("cancelledAt", time.Now().Format(time.RFC3339))
	_ = w.Close()

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPut, "/api/akcije/"+strconv.FormatUint(uint64(akcija.ID), 10), &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcija.ID), 10)}}
	c.Set("db", db)
	c.Set("username", owner.Username)
	c.Set("role", owner.Role)

	UpdateAkcija(c)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rec.Code, rec.Body.String())
	}

	var saved models.Akcija
	if err := db.First(&saved, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !saved.IsCancelled || saved.CancellationReason != "Keep me" {
		t.Fatalf("form must not change cancellation: cancelled=%v reason=%q",
			saved.IsCancelled, saved.CancellationReason)
	}
	if saved.CancelledAt == nil || saved.CancelledAt.Unix() != at.Unix() {
		t.Fatalf("CancelledAt must stay: %v", saved.CancelledAt)
	}
}

func TestFinishAction_LeavesIsCancelledFalse(t *testing.T) {
	db := testCancellationReadDB(t)
	actor := models.Korisnik{Username: "finish_cancel", Password: "x", Role: "vodic"}
	if err := db.Create(&actor).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv:          "Finish me",
		Datum:          time.Now().Add(24 * time.Hour),
		VodicID:        actor.ID,
		AddedByID:      actor.ID,
		OrganizatorTip: "vodic",
		IsCompleted:    false,
		IsCancelled:    false,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	res, err := actions.FinishAction(db, &akcija, actor, actions.FinishActionInput{})
	if err != nil {
		t.Fatalf("FinishAction: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
	if res.Akcija.IsCancelled {
		t.Fatal("finish must not set IsCancelled")
	}
	if res.Akcija.CancelledAt != nil || res.Akcija.CancellationReason != "" {
		t.Fatal("finish must not set cancellation metadata")
	}

	raw, _ := json.Marshal(res.Akcija)
	var asMap map[string]any
	_ = json.Unmarshal(raw, &asMap)
	assertCancellationFields(t, asMap, false, "", nil)
}
