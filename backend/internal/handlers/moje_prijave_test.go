package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testMojePrijaveDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.ActionSignupRequest{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	return db
}

func callGetMojePrijave(t *testing.T, db *gorm.DB, username string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/moje-prijave", nil)
	c.Set("db", db)
	c.Set("username", username)
	GetMojePrijave(c)

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, w.Body.String())
	}
	return w.Code, body
}

func uintIDsFromJSON(t *testing.T, raw any) map[uint]bool {
	t.Helper()
	out := map[uint]bool{}
	arr, ok := raw.([]any)
	if !ok {
		if raw == nil {
			return out
		}
		t.Fatalf("expected array, got %T (%v)", raw, raw)
	}
	for _, v := range arr {
		switch n := v.(type) {
		case float64:
			out[uint(n)] = true
		default:
			t.Fatalf("unexpected id type %T", v)
		}
	}
	return out
}

func TestGetMojePrijave_OnlyPrijavljenInPrijavljeneAkcije(t *testing.T) {
	db := testMojePrijaveDB(t)
	user := models.Korisnik{Username: "member1", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	future := time.Now().Add(72 * time.Hour)
	statuses := []string{"prijavljen", "popeo se", "nije uspeo", "otkazano"}
	akcije := make([]models.Akcija, len(statuses))
	for i, st := range statuses {
		akcije[i] = models.Akcija{Naziv: "A-" + st, Datum: future}
		if err := db.Create(&akcije[i]).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.Prijava{
			AkcijaID: akcije[i].ID, KorisnikID: user.ID, Status: st,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	code, body := callGetMojePrijave(t, db, user.Username)
	if code != http.StatusOK {
		t.Fatalf("status %d, body=%v", code, body)
	}
	prijavljene := uintIDsFromJSON(t, body["prijavljeneAkcije"])
	if len(prijavljene) != 1 || !prijavljene[akcije[0].ID] {
		t.Fatalf("expected only prijavljen action %d, got %v", akcije[0].ID, prijavljene)
	}
	for i := 1; i < len(statuses); i++ {
		if prijavljene[akcije[i].ID] {
			t.Fatalf("status %q must not appear in prijavljeneAkcije", statuses[i])
		}
	}
}

func TestGetMojePrijave_PendingSignupNotInPrijavljene(t *testing.T) {
	db := testMojePrijaveDB(t)
	user := models.Korisnik{Username: "pendinguser", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Pending only", Datum: future}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	req := models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: user.ID, Status: models.ActionSignupRequestPending,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetMojePrijave(t, db, user.Username)
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	prijavljene := uintIDsFromJSON(t, body["prijavljeneAkcije"])
	pending := uintIDsFromJSON(t, body["pendingSignupAkcije"])
	if prijavljene[akcija.ID] {
		t.Fatal("pending signup must not appear in prijavljeneAkcije")
	}
	if !pending[akcija.ID] {
		t.Fatal("expected action in pendingSignupAkcije")
	}
}

func TestGetMojePrijave_MultipleStatusesOnlyPrijavljenIDs(t *testing.T) {
	db := testMojePrijaveDB(t)
	user := models.Korisnik{Username: "multi", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	future := time.Now().Add(72 * time.Hour)

	var want []uint
	for i, st := range []string{"prijavljen", "popeo se", "prijavljen", "nije uspeo"} {
		a := models.Akcija{Naziv: "M-" + st + string(rune('A'+i)), Datum: future}
		if err := db.Create(&a).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.Prijava{
			AkcijaID: a.ID, KorisnikID: user.ID, Status: st,
		}).Error; err != nil {
			t.Fatal(err)
		}
		if st == "prijavljen" {
			want = append(want, a.ID)
		}
	}

	_, body := callGetMojePrijave(t, db, user.Username)
	got := uintIDsFromJSON(t, body["prijavljeneAkcije"])
	if len(got) != len(want) {
		t.Fatalf("expected %d prijavljene ids, got %d (%v)", len(want), len(got), got)
	}
	for _, id := range want {
		if !got[id] {
			t.Fatalf("missing expected id %d in %v", id, got)
		}
	}
}

// TestGetMojePrijave_CompletedActionStillPrijavljen documents current behavior:
// GetMojePrijave ne filtrira po is_completed akcije — ako prijava greškom ostane
// status="prijavljen" na završenoj akciji, ID se i dalje vraća u prijavljeneAkcije.
// UI aktivnih lista inače prikazuje završene odvojeno (isCompleted).
func TestGetMojePrijave_CompletedActionStillPrijavljen(t *testing.T) {
	db := testMojePrijaveDB(t)
	user := models.Korisnik{Username: "completed", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Done but prijavljen", Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	_, body := callGetMojePrijave(t, db, user.Username)
	prijavljene := uintIDsFromJSON(t, body["prijavljeneAkcije"])
	if !prijavljene[akcija.ID] {
		t.Fatal("current rule: completed action with status prijavljen still appears in prijavljeneAkcije")
	}
}
