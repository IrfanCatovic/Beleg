package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func callUpdateMojaPrijavaIzbori(t *testing.T, db *gorm.DB, akcijaID uint, username string, payload prijavaChoicesPayload) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	body, _ := json.Marshal(payload)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPatch, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/moja-prijava", strings.NewReader(string(body)))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	UpdateMojaPrijavaIzbori(c)
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	return w.Code, resp
}

func getPrijavaPlatio(t *testing.T, db *gorm.DB, prijavaID uint) bool {
	t.Helper()
	var p models.Prijava
	if err := db.First(&p, prijavaID).Error; err != nil {
		t.Fatal(err)
	}
	return p.Platio
}

func seedPrijavaSPlatio(t *testing.T, db *gorm.DB, akcijaID, userID uint, platio bool, smestajJSON string) models.Prijava {
	t.Helper()
	p := models.Prijava{AkcijaID: akcijaID, KorisnikID: userID, Status: "prijavljen", Platio: platio}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: smestajJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

// 1. Plaćena prijava, skuplji izbori → Platio=false
func TestUpdateMojaPrijavaIzbori_ExpensiveResetPlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_exp")
	akcija := seedOpenAkcija(t, db, 10)
	cheap := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "C", CenaPoOsobiUkupno: 30}
	expensive := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "E", CenaPoOsobiUkupno: 70}
	if err := db.Create(&cheap).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&expensive).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(cheap.ID), 10)+"]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{expensive.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false when saldo increased")
	}
}

// 2. Plaćena prijava, jeftiniji izbori → Platio=false
func TestUpdateMojaPrijavaIzbori_CheaperResetPlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_chp")
	akcija := seedOpenAkcija(t, db, 10)
	cheap := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "C", CenaPoOsobiUkupno: 30}
	expensive := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "E", CenaPoOsobiUkupno: 70}
	if err := db.Create(&cheap).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&expensive).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(expensive.ID), 10)+"]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{cheap.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false when saldo decreased")
	}
}

// 3. Isti izbori i saldo → Platio=true
func TestUpdateMojaPrijavaIzbori_SameChoicesPreservePlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_same")
	akcija := seedOpenAkcija(t, db, 10)
	s := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S", CenaPoOsobiUkupno: 30}
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(s.ID), 10)+"]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{s.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=true when saldo unchanged")
	}
}

// 4. Različiti izbori, isti saldo → Platio=true
func TestUpdateMojaPrijavaIzbori_DiffChoicesSameSaldoPreservePlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_eq")
	akcija := seedOpenAkcija(t, db, 10)
	a := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "A", CenaPoOsobiUkupno: 50}
	b := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "B", CenaPoOsobiUkupno: 50}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&b).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(a.ID), 10)+"]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{b.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=true when saldo equal")
	}
}

// 5. Platio=false, saldo changes → stays false
func TestUpdateMojaPrijavaIzbori_PlatioFalseStaysFalse(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_ff")
	akcija := seedOpenAkcija(t, db, 10)
	cheap := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "C", CenaPoOsobiUkupno: 30}
	expensive := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "E", CenaPoOsobiUkupno: 70}
	if err := db.Create(&cheap).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&expensive).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, false,
		"["+strconv.FormatUint(uint64(cheap.ID), 10)+"]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{expensive.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false")
	}
}

// 6. 0→0 Platio=true → stays true
func TestUpdateMojaPrijavaIzbori_ZeroToZeroPreservePlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_00")
	akcija := seedOpenAkcija(t, db, 10)
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true, "[]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username, prijavaChoicesPayload{})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=true for 0→0")
	}
}

// 7. 0→positive Platio=true → false
func TestUpdateMojaPrijavaIzbori_ZeroToPositiveResetPlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_0p")
	akcija := seedOpenAkcija(t, db, 10)
	s := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S", CenaPoOsobiUkupno: 30}
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true, "[]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{s.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false for 0→positive")
	}
}

// 8. positive→0 Platio=true → false
func TestUpdateMojaPrijavaIzbori_PositiveToZeroResetPlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_p0")
	akcija := seedOpenAkcija(t, db, 10)
	s := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S", CenaPoOsobiUkupno: 30}
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(s.ID), 10)+"]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username, prijavaChoicesPayload{})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false for positive→0")
	}
}

// 9. Missing old PrijavaIzbori
func TestUpdateMojaPrijavaIzbori_MissingOldIzbori(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_mis")
	akcija := seedOpenAkcija(t, db, 10)
	s := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S", CenaPoOsobiUkupno: 20}
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen", Platio: true}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{s.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false when old empty and new positive")
	}
	var izborCount int64
	db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", p.ID).Count(&izborCount)
	if izborCount != 1 {
		t.Fatalf("expected 1 izbori row, got %d", izborCount)
	}
}

// 10. Invalid new choices → no change
func TestUpdateMojaPrijavaIzbori_InvalidChoicesNoChange(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_inv2")
	akcija := seedOpenAkcija(t, db, 10)
	s := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S", CenaPoOsobiUkupno: 30}
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(s.ID), 10)+"]")

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{9999}})
	if code != 400 {
		t.Fatalf("expected 400, got %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must remain true when validation fails")
	}
	izbor := getIzbori(t, db, p.ID)
	if !strings.Contains(izbor.SelectedSmestajIDs, strconv.FormatUint(uint64(s.ID), 10)) {
		t.Fatal("old choices must remain")
	}
}

// 13. Non-prijavljen status → rejected
func TestUpdateMojaPrijavaIzbori_NonPrijavljenRejected(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_pop")
	akcija := seedOpenAkcija(t, db, 10)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "popeo se", Platio: true}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username, prijavaChoicesPayload{})
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
}

// 14. Completed action → rejected
func TestUpdateMojaPrijavaIzbori_CompletedActionRejected(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_comp")
	akcija := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 10, Javna: true, IsCompleted: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen", Platio: true}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username, prijavaChoicesPayload{})
	if code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", code)
	}
}

// 15. Admin marks paid then user changes choices (sequentially simulated)
func TestUpdateMojaPrijavaIzbori_AdminPaidThenUserChanges(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_race1")
	akcija := seedOpenAkcija(t, db, 10)
	cheap := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "C", CenaPoOsobiUkupno: 30}
	expensive := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "E", CenaPoOsobiUkupno: 70}
	if err := db.Create(&cheap).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&expensive).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, false,
		"["+strconv.FormatUint(uint64(cheap.ID), 10)+"]")

	// Admin marks paid
	if err := db.Model(&p).Update("platio", true).Error; err != nil {
		t.Fatal(err)
	}

	// User changes to expensive
	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{expensive.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false after saldo change")
	}
}

// User changes then admin marks paid
func TestUpdateMojaPrijavaIzbori_UserChangesThenAdminPaid(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_race2")
	akcija := seedOpenAkcija(t, db, 10)
	cheap := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "C", CenaPoOsobiUkupno: 30}
	expensive := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "E", CenaPoOsobiUkupno: 70}
	if err := db.Create(&cheap).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&expensive).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(cheap.ID), 10)+"]")

	// User changes to expensive → Platio=false
	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{expensive.ID}})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false after saldo change")
	}

	// Admin marks paid again
	if err := db.Model(&p).Update("platio", true).Error; err != nil {
		t.Fatal(err)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=true after admin mark")
	}
}

// 16. Two parallel choices updates
func TestUpdateMojaPrijavaIzbori_ParallelUpdatesLastWins(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_par")
	akcija := seedOpenAkcija(t, db, 10)
	a := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "A", CenaPoOsobiUkupno: 30}
	b := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "B", CenaPoOsobiUkupno: 70}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&b).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true,
		"["+strconv.FormatUint(uint64(a.ID), 10)+"]")

	// Sequential "parallel" — SQLite single-writer
	code1, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{b.ID}})
	if code1 != 200 {
		t.Fatalf("first update: expected 200, got %d", code1)
	}
	// After first: Platio=false (30→70)
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false after first update")
	}

	// Second update back to a (70→30): Platio already false, stays false
	code2, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{a.ID}})
	if code2 != 200 {
		t.Fatalf("second update: expected 200, got %d", code2)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false")
	}
	izbor := getIzbori(t, db, p.ID)
	if !strings.Contains(izbor.SelectedSmestajIDs, strconv.FormatUint(uint64(a.ID), 10)) {
		t.Fatal("last update choices must win")
	}
}

// Rejoin tests still pass (checked via existing test suite, not duplicated here).
// Completed add/bulk and guide-auto are not affected.

func TestUpdateMojaPrijavaIzbori_ResponseIncludesPlatio(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_resp")
	akcija := seedOpenAkcija(t, db, 10)
	seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true, "[]")

	code, resp := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username, prijavaChoicesPayload{})
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	platio, ok := resp["platio"]
	if !ok {
		t.Fatal("response must include platio field")
	}
	if platio != true {
		t.Fatalf("expected platio=true in response for 0→0, got %v", platio)
	}
}
