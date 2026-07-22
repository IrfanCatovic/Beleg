package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func callOtkaziAkciju(t *testing.T, db *gorm.DB, akcijaID uint, username, role string, body any) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/otkazi", &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	OtkaziAkciju(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestOtkaziAkciju_Success(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_ok", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Za otkaz", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "  Loši vremenski uslovi  ",
	})
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["message"] != "Akcija je uspešno otkazana." {
		t.Fatalf("message=%v", body["message"])
	}
	akcijaObj, ok := body["akcija"].(map[string]any)
	if !ok {
		t.Fatalf("akcija missing: %v", body)
	}
	if akcijaObj["isCancelled"] != true {
		t.Fatalf("isCancelled=%v", akcijaObj["isCancelled"])
	}
	if akcijaObj["isCompleted"] != false {
		t.Fatalf("isCompleted=%v", akcijaObj["isCompleted"])
	}
	if akcijaObj["cancellationReason"] != "Loši vremenski uslovi" {
		t.Fatalf("reason=%v", akcijaObj["cancellationReason"])
	}
	if akcijaObj["cancelledAt"] == nil {
		t.Fatal("cancelledAt required")
	}
}

func TestOtkaziAkciju_ReasonValidation(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_val", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Validacija", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name   string
		reason string
		ok     bool
	}{
		{"unicode3", "šćč", true},
		{"empty", "", false},
		{"spaces", "   ", false},
		{"short", "ab", false},
		{"over500", strings.Repeat("ć", 501), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// reset action between invalid attempts
			_ = db.Model(&models.Akcija{}).Where("id = ?", akcija.ID).Updates(map[string]any{
				"is_cancelled": false, "cancelled_at": nil, "cancellation_reason": "",
			}).Error

			code, body := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
				"reason": tc.reason,
			})
			if tc.ok {
				if code != http.StatusOK {
					t.Fatalf("status %d body=%v", code, body)
				}
				if utf8.RuneCountInString(tc.reason) != 3 {
					t.Fatal("test setup")
				}
				return
			}
			if code != http.StatusBadRequest {
				t.Fatalf("status %d want 400 body=%v", code, body)
			}
			var reloaded models.Akcija
			if err := db.First(&reloaded, akcija.ID).Error; err != nil {
				t.Fatal(err)
			}
			if reloaded.IsCancelled {
				t.Fatal("must stay active")
			}
		})
	}
}

func TestOtkaziAkciju_Unauthorized(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_own", Password: "x", Role: "vodic"}
	stranger := models.Korisnik{Username: "otk_str", Password: "x", Role: "clan"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Auth", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	u := models.Korisnik{Username: "otk_pend", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: u.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callOtkaziAkciju(t, db, akcija.ID, stranger.Username, "clan", map[string]string{
		"reason": "Validan razlog",
	})
	if code != http.StatusForbidden {
		t.Fatalf("status %d", code)
	}
	var reloaded models.Akcija
	if err := db.First(&reloaded, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.IsCancelled {
		t.Fatal("must not cancel")
	}
	var pending models.ActionSignupRequest
	if err := db.First(&pending, req.ID).Error; err != nil {
		t.Fatal(err)
	}
	if pending.Status != models.ActionSignupRequestPending {
		t.Fatal("no cleanup on unauthorized")
	}
}

func TestOtkaziAkciju_NotFound(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_nf", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callOtkaziAkciju(t, db, 99999, owner.Username, "vodic", map[string]string{
		"reason": "Validan razlog",
	})
	if code != http.StatusNotFound {
		t.Fatalf("status %d", code)
	}
}

func TestOtkaziAkciju_CompletedAndAlreadyCancelled(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_life", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}

	completed := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic", IsCompleted: true,
	}
	if err := db.Create(&completed).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callOtkaziAkciju(t, db, completed.ID, owner.Username, "vodic", map[string]string{
		"reason": "Validan razlog",
	})
	if code != http.StatusConflict {
		t.Fatalf("completed cancel status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}

	active := models.Akcija{
		Naziv: "Active", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&active).Error; err != nil {
		t.Fatal(err)
	}
	code, first := callOtkaziAkciju(t, db, active.ID, owner.Username, "vodic", map[string]string{
		"reason": "Prvi razlog xx",
	})
	if code != http.StatusOK {
		t.Fatalf("first cancel %d %v", code, first)
	}
	code, second := callOtkaziAkciju(t, db, active.ID, owner.Username, "vodic", map[string]string{
		"reason": "Drugi razlog xx",
	})
	if code != http.StatusConflict {
		t.Fatalf("second cancel %d %v", code, second)
	}
	if second["error"] != helpers.ErrAkcijaAlreadyCancelled.Error() {
		t.Fatalf("error=%v", second["error"])
	}
	var reloaded models.Akcija
	if err := db.First(&reloaded, active.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.CancellationReason != "Prvi razlog xx" {
		t.Fatalf("reason=%q", reloaded.CancellationReason)
	}
}

func TestOtkaziAkciju_CancelThenUpdateBlocked(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_upd", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Upd", Planina: "P", Vrh: "V", Datum: time.Now().Add(48 * time.Hour),
		Tezina: "lako", VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
		UkupnoMetaraUsponaAkcija: 10, UkupnoKmAkcija: 1,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "Za update test",
	})
	if code != http.StatusOK {
		t.Fatalf("cancel %d", code)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		akcija.Naziv = "Hacked"
		return executeUpdateAkcijaTx(tx, akcija, ActionNestedSyncInput{})
	})
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("err=%v", err)
	}
}

func TestOtkaziAkciju_ParallelCancels(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_par", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Parallel", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		codes []int
	)
	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func() {
			defer wg.Done()
			code, _ := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
				"reason": "Paralelni razlog",
			})
			mu.Lock()
			codes = append(codes, code)
			mu.Unlock()
		}()
	}
	wg.Wait()

	var okN, conflictN int
	for _, code := range codes {
		switch code {
		case http.StatusOK:
			okN++
		case http.StatusConflict:
			conflictN++
		default:
			t.Fatalf("unexpected code %d in %v", code, codes)
		}
	}
	if okN != 1 || conflictN != 1 {
		t.Fatalf("codes=%v", codes)
	}
}

func TestOtkaziAkciju_CancelThenFinish(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_fin", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "CF", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "Pa finish",
	})
	if code != http.StatusOK {
		t.Fatalf("cancel %d", code)
	}
	code, body := callZavrsiAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]float64{"rashodNaAkciji": 0})
	if code != http.StatusConflict {
		t.Fatalf("finish %d body=%v", code, body)
	}
}

func TestOtkaziAkciju_FinishThenCancel(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "fin_otk", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "FC", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callZavrsiAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]float64{"rashodNaAkciji": 0})
	if code != http.StatusOK {
		t.Fatalf("finish %d", code)
	}
	code, body := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "Posle finish",
	})
	if code != http.StatusConflict {
		t.Fatalf("cancel %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestOtkaziAkciju_DetailStillAvailable(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := models.Korisnik{Username: "otk_det", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Detail", Datum: time.Now().Add(48 * time.Hour), Javna: true,
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "Za detail",
	})
	if code != http.StatusOK {
		t.Fatalf("cancel %d", code)
	}
	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("detail %d", code)
	}
	if body["isCancelled"] != true {
		t.Fatalf("body=%v", body)
	}
	if body["cancellationReason"] != "Za detail" {
		t.Fatalf("reason=%v", body["cancellationReason"])
	}
}
