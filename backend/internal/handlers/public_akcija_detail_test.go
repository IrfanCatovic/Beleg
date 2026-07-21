package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPublicAkcijaDetailDB(t *testing.T) *gorm.DB {
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

func callGetPublicAkcijaByID(t *testing.T, db *gorm.DB, akcijaID uint) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/akcije/"+strconv.FormatUint(uint64(akcijaID), 10), nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	GetPublicAkcijaByID([]byte("test-jwt-secret"))(c)

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, w.Body.String())
	}
	return w.Code, body
}

func countField(t *testing.T, body map[string]any, key string) int64 {
	t.Helper()
	v, ok := body[key]
	if !ok {
		t.Fatalf("response missing %q", key)
	}
	switch n := v.(type) {
	case float64:
		return int64(n)
	default:
		t.Fatalf("%q has unexpected type %T", key, v)
		return 0
	}
}

func createPublicAkcija(t *testing.T, db *gorm.DB, maxLjudi int) models.Akcija {
	t.Helper()
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{
		Naziv:   "Test akcija",
		Datum:   future,
		Javna:   true,
		MaxLjudi: maxLjudi,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	return akcija
}

func createUser(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func createPrijava(t *testing.T, db *gorm.DB, akcijaID, korisnikID uint, status string) {
	t.Helper()
	if err := db.Create(&models.Prijava{
		AkcijaID:   akcijaID,
		KorisnikID: korisnikID,
		Status:     status,
	}).Error; err != nil {
		t.Fatal(err)
	}
}

func TestGetPublicAkcijaByID_PrijaveCountAndCapacityUsedCount_MixedStatuses(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	akcija := createPublicAkcija(t, db, 5)

	for i := 0; i < 4; i++ {
		u := createUser(t, db, "p"+strconv.Itoa(i))
		createPrijava(t, db, akcija.ID, u.ID, "prijavljen")
	}
	failed := createUser(t, db, "failed1")
	createPrijava(t, db, akcija.ID, failed.ID, "nije uspeo")

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if got := countField(t, body, "prijaveCount"); got != 4 {
		t.Fatalf("prijaveCount=%d want 4", got)
	}
	if got := countField(t, body, "capacityUsedCount"); got != 5 {
		t.Fatalf("capacityUsedCount=%d want 5", got)
	}
}

func TestGetPublicAkcijaByID_CapacityExcludesOtkazano(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	akcija := createPublicAkcija(t, db, 10)

	statuses := []string{"prijavljen", "prijavljen", "popeo se", "popeo se", "popeo se", "nije uspeo", "otkazano"}
	for i, st := range statuses {
		u := createUser(t, db, "u"+strconv.Itoa(i))
		createPrijava(t, db, akcija.ID, u.ID, st)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if got := countField(t, body, "prijaveCount"); got != 2 {
		t.Fatalf("prijaveCount=%d want 2", got)
	}
	if got := countField(t, body, "capacityUsedCount"); got != 6 {
		t.Fatalf("capacityUsedCount=%d want 6", got)
	}
}

func TestGetPublicAkcijaByID_PendingSignupNotInCounts(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	akcija := createPublicAkcija(t, db, 5)
	user := createUser(t, db, "pending")

	if err := db.Create(&models.ActionSignupRequest{
		AkcijaID:    akcija.ID,
		RequesterID: user.ID,
		Status:      models.ActionSignupRequestPending,
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if got := countField(t, body, "prijaveCount"); got != 0 {
		t.Fatalf("prijaveCount=%d want 0", got)
	}
	if got := countField(t, body, "capacityUsedCount"); got != 0 {
		t.Fatalf("capacityUsedCount=%d want 0", got)
	}
}

func TestGetPublicAkcijaByID_GuidePrijavljenInBothCounts(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	guide := createUser(t, db, "guide")
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{
		Naziv:          "Guide action",
		Datum:          future,
		Javna:          true,
		VodicID:        guide.ID,
		OrganizatorTip: "vodic",
		MaxLjudi:       5,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	createPrijava(t, db, akcija.ID, guide.ID, "prijavljen")

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if got := countField(t, body, "prijaveCount"); got != 1 {
		t.Fatalf("prijaveCount=%d want 1", got)
	}
	if got := countField(t, body, "capacityUsedCount"); got != 1 {
		t.Fatalf("capacityUsedCount=%d want 1", got)
	}
}

func TestGetPublicAkcijaByID_CompletedActionSameCountSemantics(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	future := time.Now().Add(-24 * time.Hour)
	akcija := models.Akcija{
		Naziv:       "Completed",
		Datum:       future,
		Javna:       true,
		IsCompleted: true,
		MaxLjudi:    5,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 7; i++ {
		u := createUser(t, db, "s"+strconv.Itoa(i))
		createPrijava(t, db, akcija.ID, u.ID, "popeo se")
	}
	for i := 0; i < 2; i++ {
		u := createUser(t, db, "f"+strconv.Itoa(i))
		createPrijava(t, db, akcija.ID, u.ID, "nije uspeo")
	}
	left := createUser(t, db, "left")
	createPrijava(t, db, akcija.ID, left.ID, "prijavljen")

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if got := countField(t, body, "prijaveCount"); got != 1 {
		t.Fatalf("prijaveCount=%d want 1", got)
	}
	if got := countField(t, body, "capacityUsedCount"); got != 10 {
		t.Fatalf("capacityUsedCount=%d want 10", got)
	}
}

func TestGetPublicAkcijaByID_MaxLjudiZeroReturnsRealCapacityCount(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	akcija := createPublicAkcija(t, db, 0)

	for i := 0; i < 3; i++ {
		u := createUser(t, db, "m"+strconv.Itoa(i))
		createPrijava(t, db, akcija.ID, u.ID, "prijavljen")
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if got := countField(t, body, "prijaveCount"); got != 3 {
		t.Fatalf("prijaveCount=%d want 3", got)
	}
	if got := countField(t, body, "capacityUsedCount"); got != 3 {
		t.Fatalf("capacityUsedCount=%d want 3 (maxLjudi=0 is unlimited, not zero count)", got)
	}
}

func TestGetPublicAkcijaByID_CapacityCountErrorReturns500(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	akcija := createPublicAkcija(t, db, 5)

	if err := db.Migrator().DropTable(&models.Prijava{}); err != nil {
		t.Fatal(err)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusInternalServerError {
		t.Fatalf("status %d want 500, body=%v", code, body)
	}
	if _, ok := body["capacityUsedCount"]; ok {
		t.Fatal("must not return capacityUsedCount on count error")
	}
}

func TestGetPublicAkcijaByID_LimitedResponseOmitsCountFields(t *testing.T) {
	db := testPublicAkcijaDetailDB(t)
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{
		Naziv: "Private",
		Datum: future,
		Javna: false,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["limited"] != true {
		t.Fatalf("expected limited response, got %v", body)
	}
	if _, ok := body["prijaveCount"]; ok {
		t.Fatal("limited response must not include prijaveCount")
	}
	if _, ok := body["capacityUsedCount"]; ok {
		t.Fatal("limited response must not include capacityUsedCount")
	}
	if _, ok := body["maxLjudi"]; ok {
		t.Fatal("limited response must not include maxLjudi")
	}
}
