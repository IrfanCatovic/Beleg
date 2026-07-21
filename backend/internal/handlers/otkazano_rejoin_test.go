package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func seedOpenAkcija(t *testing.T, db *gorm.DB, maxLjudi int) models.Akcija {
	t.Helper()
	akcija := models.Akcija{
		Naziv: "Rejoin", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: maxLjudi, Javna: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	return akcija
}

func seedUser(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedOtkazanoPrijava(t *testing.T, db *gorm.DB, akcijaID, userID uint, platio bool, smestaj, prevoz string) models.Prijava {
	t.Helper()
	p := models.Prijava{AkcijaID: akcijaID, KorisnikID: userID, Status: "otkazano", Platio: platio}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	izbor := models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: smestaj, SelectedPrevozIDs: prevoz, SelectedRentItemsRaw: "[]",
	}
	if err := db.Create(&izbor).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func getPrijavaStatus(t *testing.T, db *gorm.DB, prijavaID uint) string {
	t.Helper()
	var p models.Prijava
	if err := db.First(&p, prijavaID).Error; err != nil {
		t.Fatal(err)
	}
	return p.Status
}

func getIzbori(t *testing.T, db *gorm.DB, prijavaID uint) models.PrijavaIzbori {
	t.Helper()
	var izbor models.PrijavaIzbori
	if err := db.Where("prijava_id = ?", prijavaID).First(&izbor).Error; err != nil {
		t.Fatal(err)
	}
	return izbor
}

func callCancelSignup(t *testing.T, db *gorm.DB, akcijaID uint, username string) int {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/signup-request", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	CancelMojActionSignupRequest(c)
	return w.Code
}

func callOtkaziPrijavu(t *testing.T, db *gorm.DB, akcijaID uint, username string) int {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/prijavi", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	OtkaziPrijavuNaAkciju(c)
	return w.Code
}

func acceptSignupTx(t *testing.T, db *gorm.DB, akcija models.Akcija, user models.Korisnik, choices prijavaChoicesPayload) (models.Prijava, error) {
	t.Helper()
	var p models.Prijava
	err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		p, err = createPrijavaFromChoices(tx, akcija.ID, user, choices)
		return err
	})
	return p, err
}

func rejectSignupRequest(t *testing.T, db *gorm.DB, reqID uint) {
	t.Helper()
	now := time.Now()
	if err := db.Model(&models.ActionSignupRequest{}).Where("id = ?", reqID).Updates(map[string]any{
		"status": models.ActionSignupRequestRejected, "responded_at": now,
	}).Error; err != nil {
		t.Fatal(err)
	}
}

// 1. otkazano + otvorena akcija → novi pending, prijava ostaje otkazano
func TestOtkazanoRejoin_CreatesPendingWhilePrijavaStaysCancelled(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_otk")
	akcija := seedOpenAkcija(t, db, 5)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[1]", "[]")

	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("expected pending signup")
	}
	if getPrijavaStatus(t, db, p.ID) != "otkazano" {
		t.Fatal("prijava must stay otkazano while pending")
	}
}

// 2. aktivna prijavljen → signup odbijen
func TestOtkazanoRejoin_BlocksWhenPrijavljen(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_pri")
	akcija := seedOpenAkcija(t, db, 5)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest || body["error"] != helpers.ErrDuplicatePrijava.Error() {
		t.Fatalf("expected duplicate, got %d %v", code, body)
	}
}

// 3. popeo se / nije uspeo → signup odbijen
func TestOtkazanoRejoin_BlocksSummitStatuses(t *testing.T) {
	db := testPrijaviDB(t)
	akcija := seedOpenAkcija(t, db, 5)
	for i, st := range []string{"popeo se", "nije uspeo"} {
		user := seedUser(t, db, "summit_"+strconv.Itoa(i))
		if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: st}).Error; err != nil {
			t.Fatal(err)
		}
		code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
		if code != http.StatusBadRequest || body["error"] != helpers.ErrDuplicatePrijava.Error() {
			t.Fatalf("status %s: expected duplicate, got %d %v", st, code, body)
		}
	}
}

// 4. otkazano + postojeći pending → drugi pending odbijen
func TestOtkazanoRejoin_BlocksDuplicatePending(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_dup_p")
	akcija := seedOpenAkcija(t, db, 5)
	seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")

	code1, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code1 != http.StatusOK {
		t.Fatalf("first pending: %d", code1)
	}
	code2, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code2 != http.StatusBadRequest || body["error"] != helpers.ErrPendingSignupExists.Error() {
		t.Fatalf("expected pending duplicate, got %d %v", code2, body)
	}
}

// 5. korisnik otkaže novi pending → stara prijava otkazano
func TestOtkazanoRejoin_CancelPendingKeepsOtkazanoPrijava(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_cancel_p")
	akcija := seedOpenAkcija(t, db, 5)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")

	if code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username); code != http.StatusOK {
		t.Fatalf("signup: %d", code)
	}
	if callCancelSignup(t, db, akcija.ID, user.Username) != http.StatusOK {
		t.Fatal("cancel pending failed")
	}
	if getPrijavaStatus(t, db, p.ID) != "otkazano" {
		t.Fatal("prijava must remain otkazano")
	}
}

// 6. admin odbije novi pending → stara prijava otkazano
func TestOtkazanoRejoin_RejectPendingKeepsOtkazanoPrijava(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_rej")
	akcija := seedOpenAkcija(t, db, 5)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")

	if code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username); code != http.StatusOK {
		t.Fatalf("signup: %d", code)
	}
	var req models.ActionSignupRequest
	if err := db.Where("akcija_id = ? AND requester_id = ?", akcija.ID, user.ID).First(&req).Error; err != nil {
		t.Fatal(err)
	}
	rejectSignupRequest(t, db, req.ID)
	if getPrijavaStatus(t, db, p.ID) != "otkazano" {
		t.Fatal("prijava must remain otkazano after reject")
	}
}

// 7. admin prihvati → isti ID, status prijavljen, jedan red
func TestOtkazanoRejoin_AcceptReactivatesSamePrijava(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_acc")
	akcija := seedOpenAkcija(t, db, 5)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")

	p2, err := acceptSignupTx(t, db, akcija, user, prijavaChoicesPayload{})
	if err != nil {
		t.Fatalf("accept: %v", err)
	}
	if p2.ID != p.ID {
		t.Fatalf("expected same prijava id %d, got %d", p.ID, p2.ID)
	}
	if p2.Status != "prijavljen" {
		t.Fatalf("expected prijavljen, got %s", p2.Status)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, user.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected 1 prijava row, got %d", n)
	}
}

// 8. različiti logistički izbori → nakon accepta novi izbori
func TestOtkazanoRejoin_AcceptUpdatesChoices(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_izb")
	akcija := seedOpenAkcija(t, db, 5)
	smestaj := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S1"}
	smestaj2 := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S2"}
	if err := db.Create(&smestaj).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&smestaj2).Error; err != nil {
		t.Fatal(err)
	}
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "["+strconv.FormatUint(uint64(smestaj.ID), 10)+"]", "[]")

	_, err := acceptSignupTx(t, db, akcija, user, prijavaChoicesPayload{SelectedSmestajIDs: []uint{smestaj2.ID}})
	if err != nil {
		t.Fatalf("accept: %v", err)
	}
	izbor := getIzbori(t, db, p.ID)
	if !strings.Contains(izbor.SelectedSmestajIDs, strconv.FormatUint(uint64(smestaj2.ID), 10)) {
		t.Fatalf("expected new smestaj choice, got %s", izbor.SelectedSmestajIDs)
	}
	if strings.Contains(izbor.SelectedSmestajIDs, strconv.FormatUint(uint64(smestaj.ID), 10)) {
		t.Fatalf("old smestaj must not remain, got %s", izbor.SelectedSmestajIDs)
	}
}

// 9. nevalidni izbori → accept odbijen, prijava otkazano, stari izbori
func TestOtkazanoRejoin_InvalidChoicesRollback(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_inv")
	akcija := seedOpenAkcija(t, db, 5)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[99]", "[]")

	_, err := acceptSignupTx(t, db, akcija, user, prijavaChoicesPayload{SelectedSmestajIDs: []uint{9999}})
	if err == nil || !strings.Contains(err.Error(), "Nevažeći ID smeštaja") {
		t.Fatalf("expected invalid smestaj error, got %v", err)
	}
	if getPrijavaStatus(t, db, p.ID) != "otkazano" {
		t.Fatal("prijava must stay otkazano")
	}
	izbor := getIzbori(t, db, p.ID)
	if izbor.SelectedSmestajIDs != "[99]" {
		t.Fatalf("old choices must remain, got %s", izbor.SelectedSmestajIDs)
	}
}

// 10. akcija puna prije accepta → odbijen, prijava otkazano
func TestOtkazanoRejoin_AcceptRejectsWhenFull(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_full")
	filler := seedUser(t, db, "u_fill")
	akcija := seedOpenAkcija(t, db, 1)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: filler.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	_, err := acceptSignupTx(t, db, akcija, user, prijavaChoicesPayload{})
	if !errors.Is(err, helpers.ErrAkcijaCapacityFull) {
		t.Fatalf("expected capacity full, got %v", err)
	}
	if getPrijavaStatus(t, db, p.ID) != "otkazano" {
		t.Fatal("prijava must stay otkazano")
	}
}

// 11. rok prošao prije slanja zahtjeva
func TestOtkazanoRejoin_RejectsAfterDeadline(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_dead")
	past := time.Now().AddDate(0, 0, -1)
	akcija := models.Akcija{
		Naziv: "Past", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 5, Javna: true, RokPrijava: &past,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d %v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending on expired deadline")
	}
}

// 12. Platio=true ostaje nakon reaktivacije
func TestOtkazanoRejoin_PreservesPlatioOnReactivation(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_pay")
	akcija := seedOpenAkcija(t, db, 5)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, true, "[]", "[]")

	if _, err := acceptSignupTx(t, db, akcija, user, prijavaChoicesPayload{}); err != nil {
		t.Fatalf("accept: %v", err)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !reloaded.Platio {
		t.Fatal("Platio must remain true after reactivation")
	}
}

// 13. dva paralelna accepta → jedan prijava red, jedan izbori red
func TestOtkazanoRejoin_ConcurrentAcceptSingleRow(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_race")
	akcija := seedOpenAkcija(t, db, 5)
	p := seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")

	var wg sync.WaitGroup
	errs := make([]error, 2)
	results := make([]models.Prijava, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			results[idx], errs[idx] = acceptSignupTx(t, db, akcija, user, prijavaChoicesPayload{})
		}(i)
	}
	wg.Wait()

	success := 0
	for i, err := range errs {
		if err == nil {
			success++
			if results[i].ID != p.ID {
				t.Fatalf("expected prijava id %d, got %d", p.ID, results[i].ID)
			}
		}
	}
	if success != 1 {
		t.Fatalf("expected exactly one successful accept, got %d errors=%v", success, errs)
	}
	var prijavaCount, izborCount int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, user.ID).Count(&prijavaCount)
	db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", p.ID).Count(&izborCount)
	if prijavaCount != 1 || izborCount != 1 {
		t.Fatalf("expected 1 prijava and 1 izbor, got %d/%d", prijavaCount, izborCount)
	}
	if getPrijavaStatus(t, db, p.ID) != "prijavljen" {
		t.Fatal("prijava must be prijavljen")
	}
}

// 14. self-cancel potvrđene prijave → hard delete, rejoin radi
func TestOtkazanoRejoin_SelfCancelHardDeleteAllowsRejoin(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_self")
	akcija := seedOpenAkcija(t, db, 5)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	if callOtkaziPrijavu(t, db, akcija.ID, user.Username) != http.StatusOK {
		t.Fatal("self cancel failed")
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, user.ID).Count(&n)
	if n != 0 {
		t.Fatal("prijava should be hard-deleted")
	}
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("rejoin after self-cancel should succeed, got %d", code)
	}
}

func TestOtkazanoRejoin_SignupRequestStoresNewChoices(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "u_req_ch")
	akcija := seedOpenAkcija(t, db, 5)
	smestaj := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "ReqS"}
	if err := db.Create(&smestaj).Error; err != nil {
		t.Fatal(err)
	}
	seedOtkazanoPrijava(t, db, akcija.ID, user.ID, false, "[]", "[]")

	bodyBytes, _ := json.Marshal(prijavaChoicesPayload{SelectedSmestajIDs: []uint{smestaj.ID}})
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcija.ID), 10)+"/prijava", strings.NewReader(string(bodyBytes)))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcija.ID), 10)}}
	c.Set("db", db)
	c.Set("username", user.Username)
	PrijaviNaAkciju(c)
	if w.Code != http.StatusOK {
		t.Fatalf("signup: %d %s", w.Code, w.Body.String())
	}
	var req models.ActionSignupRequest
	if err := db.Where("akcija_id = ? AND requester_id = ?", akcija.ID, user.ID).First(&req).Error; err != nil {
		t.Fatal(err)
	}
	smestajIDs, _, _ := parseSignupChoices(&req)
	if len(smestajIDs) != 1 || smestajIDs[0] != smestaj.ID {
		t.Fatalf("pending request should store new choices, got %v", smestajIDs)
	}
}
