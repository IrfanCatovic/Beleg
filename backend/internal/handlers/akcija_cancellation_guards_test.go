package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func seedCancelledAkcija(t *testing.T, db *gorm.DB, owner models.Korisnik, opts ...func(*models.Akcija)) models.Akcija {
	t.Helper()
	at := time.Date(2026, 7, 22, 10, 0, 0, 0, time.UTC)
	a := models.Akcija{
		Naziv:              "Cancelled",
		Datum:              time.Now().Add(72 * time.Hour),
		MaxLjudi:           10,
		Javna:              true,
		VodicID:            owner.ID,
		AddedByID:          owner.ID,
		OrganizatorTip:     "vodic",
		IsCancelled:        true,
		CancelledAt:        &at,
		CancellationReason: "Vrijeme",
	}
	for _, opt := range opts {
		opt(&a)
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func TestCancelled_CreatePendingBlocked(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_cp")
	requester := seedRespondRequester(t, db, "req_canc_cp")
	akcija := seedCancelledAkcija(t, db, vodic)

	code, body := callPrijaviNaAkcijuJSON(t, db, akcija.ID, requester.Username, map[string]any{})
	if code != http.StatusConflict {
		t.Fatalf("status %d want 409 body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	var n int64
	db.Model(&models.ActionSignupRequest{}).Where("akcija_id = ?", akcija.ID).Count(&n)
	if n != 0 {
		t.Fatal("must not create signup request")
	}
	db.Model(&models.Obavestenje{}).Count(&n)
	if n != 0 {
		t.Fatal("must not notify")
	}
}

func TestCancelled_AcceptPendingBlocked_RequestStaysPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_acc")
	requester := seedRespondRequester(t, db, "req_canc_acc")
	akcija := seedCancelledAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusConflict {
		t.Fatalf("status %d want 409 body=%v", code, body)
	}

	var reloaded models.ActionSignupRequest
	if err := db.First(&reloaded, req.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.Status != models.ActionSignupRequestPending {
		t.Fatalf("status=%s want pending", reloaded.Status)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ?", akcija.ID).Count(&n)
	if n != 0 {
		t.Fatal("must not create prijava")
	}
}

func TestCancelled_RejectAndUserCancelPendingAllowed(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_rej")
	requester := seedRespondRequester(t, db, "req_canc_rej")
	akcija := seedCancelledAkcija(t, db, vodic)
	reqReject := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, _ := callRespondSignup(t, db, akcija.ID, reqReject.ID, vodic, "reject")
	if code != http.StatusOK {
		t.Fatalf("reject status %d", code)
	}
	var rejected models.ActionSignupRequest
	if err := db.First(&rejected, reqReject.ID).Error; err != nil {
		t.Fatal(err)
	}
	if rejected.Status != models.ActionSignupRequestRejected {
		t.Fatalf("status=%s", rejected.Status)
	}

	requester2 := seedRespondRequester(t, db, "req_canc_uc")
	reqCancel := seedPendingSignup(t, db, akcija.ID, requester2.ID, "[]", "[]", "[]")
	code, _ = callCancelSignupCapture(t, db, akcija.ID, requester2.Username)
	if code != http.StatusOK {
		t.Fatalf("user cancel status %d", code)
	}
	var cancelled models.ActionSignupRequest
	if err := db.First(&cancelled, reqCancel.ID).Error; err != nil {
		t.Fatal(err)
	}
	if cancelled.Status != models.ActionSignupRequestCancelled {
		t.Fatalf("status=%s", cancelled.Status)
	}
}

func TestCancelled_FinishBlocked_NoSideEffects(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_fin")
	requester := seedRespondRequester(t, db, "req_canc_fin")
	akcija := seedCancelledAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
	invite := models.ActionInviteLink{AkcijaID: akcija.ID, TokenHash: "abc"}
	if err := db.Create(&invite).Error; err != nil {
		t.Fatal(err)
	}

	_, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("expected ErrAkcijaCancelled, got %v", err)
	}

	var reloaded models.Akcija
	if err := db.First(&reloaded, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.IsCompleted || !reloaded.IsCancelled {
		t.Fatalf("lifecycle changed: completed=%v cancelled=%v", reloaded.IsCompleted, reloaded.IsCancelled)
	}
	var pending models.ActionSignupRequest
	if err := db.First(&pending, req.ID).Error; err != nil {
		t.Fatal(err)
	}
	if pending.Status != models.ActionSignupRequestPending {
		t.Fatal("pending must stay pending")
	}
	var link models.ActionInviteLink
	if err := db.First(&link, invite.ID).Error; err != nil {
		t.Fatal(err)
	}
	if link.RevokedAt != nil {
		t.Fatal("invite must not be revoked by blocked finish")
	}
	var txCount int64
	db.Model(&models.Transakcija{}).Count(&txCount)
	if txCount != 0 {
		t.Fatal("no finance rows")
	}
}

func TestCancelled_HardDeleteEmptyBlocked(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_canc_del")
	akcija := seedCancelledAkcija(t, db, owner)

	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaHardDeleteCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("row must remain")
	}
}

func TestCancelled_SelfCancelConfirmedBlocked(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_sc")
	member := seedRespondRequester(t, db, "mem_canc_sc")
	akcija := seedCancelledAkcija(t, db, vodic)
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code := callOtkaziPrijavu(t, db, akcija.ID, member.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d want 409", code)
	}
	if countWhere(t, db, &models.Prijava{}, "akcija_id = ?", akcija.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestCancelled_UpdateStatusAndMarkPaidBlocked(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_st")
	member := seedRespondRequester(t, db, "mem_canc_st")
	akcija := seedCancelledAkcija(t, db, vodic)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen", Platio: false}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callUpdatePrijavaStatus(t, db, p.ID, "popeo se", vodic.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status update %d body=%v", code, body)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.Status != "prijavljen" {
		t.Fatalf("status=%s", reloaded.Status)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	raw, _ := json.Marshal(map[string]bool{"platio": true})
	c.Request = httptest.NewRequest(http.MethodPatch, "/prijave/"+strconv.Itoa(int(p.ID))+"/platio", bytes.NewReader(raw))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(int(p.ID))}}
	c.Set("db", db)
	c.Set("username", vodic.Username)
	c.Set("role", "vodic")
	UpdatePrijavaPlatioStatus(c)
	if w.Code != http.StatusConflict {
		t.Fatalf("platio status %d body=%s", w.Code, w.Body.String())
	}
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.Platio {
		t.Fatal("Platio must stay false")
	}
}

func TestCancelled_HostDeletePrijavaBlocked(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_hd")
	member := seedRespondRequester(t, db, "mem_canc_hd")
	akcija := seedCancelledAkcija(t, db, vodic)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/prijave/"+strconv.Itoa(int(p.ID)), nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(int(p.ID))}}
	c.Set("db", db)
	c.Set("username", vodic.Username)
	c.Set("role", "vodic")
	DeletePrijava(c)
	if w.Code != http.StatusConflict {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
	if countWhere(t, db, &models.Prijava{}, "id = ?", p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestCancelled_InviteCreateBlocked_RevokeAllowed(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_inv")
	akcija := seedCancelledAkcija(t, db, vodic, func(a *models.Akcija) { a.Javna = false })
	if err := db.Create(&models.ActionInviteLink{AkcijaID: akcija.ID, TokenHash: "tok1"}).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.Itoa(int(akcija.ID))+"/invite-link", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(int(akcija.ID))}}
	c.Set("db", db)
	c.Set("username", vodic.Username)
	c.Set("role", "vodic")
	CreateOrRegenerateActionInviteLink(c)
	if w.Code != http.StatusConflict {
		t.Fatalf("create invite %d body=%s", w.Code, w.Body.String())
	}

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodDelete, "/akcije/"+strconv.Itoa(int(akcija.ID))+"/invite-link", nil)
	c2.Params = gin.Params{{Key: "id", Value: strconv.Itoa(int(akcija.ID))}}
	c2.Set("db", db)
	c2.Set("username", vodic.Username)
	c2.Set("role", "vodic")
	RevokeActionInviteLink(c2)
	if w2.Code != http.StatusOK {
		t.Fatalf("revoke %d body=%s", w2.Code, w2.Body.String())
	}
	var link models.ActionInviteLink
	if err := db.Where("akcija_id = ?", akcija.ID).First(&link).Error; err != nil {
		t.Fatal(err)
	}
	if link.RevokedAt == nil {
		t.Fatal("invite must be revoked")
	}
}

func TestCancelled_CompletedAddBlocked(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_add")
	member := seedRespondRequester(t, db, "mem_canc_add")
	akcija := seedCancelledAkcija(t, db, vodic, func(a *models.Akcija) {
		a.IsCompleted = false
	})

	_, err := actions.AddMemberToCompletedAction(db, &akcija, &member)
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		// cancelled + not completed → cancelled preferred after lockCompleted check order
		if !errors.Is(err, actions.ErrActionNotCompleted) && !errors.Is(err, helpers.ErrAkcijaCancelled) {
			t.Fatalf("unexpected err %v", err)
		}
	}

	// Contradictory / cancelled-with-completed-flag: still clear cancelled error.
	akcija2 := seedCancelledAkcija(t, db, vodic, func(a *models.Akcija) {
		a.Naziv = "Canc completed"
		a.IsCompleted = true
	})
	_, err = actions.AddMemberToCompletedAction(db, &akcija2, &member)
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("expected ErrAkcijaCancelled, got %v", err)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ?", akcija2.ID).Count(&n)
	if n != 0 {
		t.Fatal("no prijava")
	}
}

func TestCancelled_ListsExcludeCancelled(t *testing.T) {
	db := testCancellationReadDB(t)
	future := time.Now().Add(48 * time.Hour)
	active := models.Akcija{Naziv: "Active", Datum: future, Javna: true}
	completed := models.Akcija{Naziv: "Done", Datum: future.Add(-96 * time.Hour), Javna: true, IsCompleted: true}
	cancelled := models.Akcija{Naziv: "Canc", Datum: future, Javna: true, IsCancelled: true}
	contradictory := models.Akcija{Naziv: "Both", Datum: future, Javna: true, IsCompleted: true, IsCancelled: true}
	for _, a := range []*models.Akcija{&active, &completed, &cancelled, &contradictory} {
		if err := db.Create(a).Error; err != nil {
			t.Fatal(err)
		}
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
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body=%v", w.Code, body)
	}
	aktivne, _ := body["aktivne"].([]any)
	if len(aktivne) != 1 {
		t.Fatalf("aktivne len=%d want 1 (only active)", len(aktivne))
	}
	row := aktivne[0].(map[string]any)
	if row["naziv"] != "Active" {
		t.Fatalf("aktivne=%v", row["naziv"])
	}

	// Club zavrsene path: seed club + user.
	klub := models.Klubovi{Naziv: "K"}
	if err := db.Create(&klub).Error; err != nil {
		t.Fatal(err)
	}
	clubID := klub.ID
	completed.KlubID = &clubID
	cancelled.KlubID = &clubID
	contradictory.KlubID = &clubID
	active.KlubID = &clubID
	_ = db.Save(&completed).Error
	_ = db.Save(&cancelled).Error
	_ = db.Save(&contradictory).Error
	_ = db.Save(&active).Error
	user := models.Korisnik{Username: "club_list", Password: "x", Role: "clan", KlubID: &clubID}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodGet, "/api/akcije", nil)
	c2.Set("db", db)
	c2.Set("username", user.Username)
	c2.Set("role", "clan")
	c2.Set("klubId", clubID)
	GetAkcije(c2)
	var body2 map[string]any
	_ = json.Unmarshal(w2.Body.Bytes(), &body2)
	zavrsene, _ := body2["zavrsene"].([]any)
	if len(zavrsene) != 1 {
		t.Fatalf("zavrsene len=%d want 1 body=%v", len(zavrsene), body2)
	}
	if zavrsene[0].(map[string]any)["naziv"] != "Done" {
		t.Fatalf("zavrsene row=%v", zavrsene[0])
	}

	code, detail := callGetPublicAkcijaByID(t, db, cancelled.ID)
	if code != http.StatusOK {
		t.Fatalf("detail status %d", code)
	}
	if detail["isCancelled"] != true {
		t.Fatal("detail must return cancelled")
	}
}

func TestCancelled_MojePrijaveKeepsHistory(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_mp")
	member := seedRespondRequester(t, db, "mem_canc_mp")
	akcija := seedCancelledAkcija(t, db, vodic)
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetMojePrijave(t, db, member.Username)
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	ids, _ := body["prijavljeneAkcije"].([]any)
	found := false
	for _, raw := range ids {
		if uint(raw.(float64)) == akcija.ID {
			found = true
		}
	}
	if !found {
		t.Fatalf("cancelled action missing from prijavljeneAkcije: %v", ids)
	}
	otkazive, _ := body["otkaziveAkcije"].([]any)
	for _, raw := range otkazive {
		if uint(raw.(float64)) == akcija.ID {
			t.Fatal("cancelled must not be in otkaziveAkcije")
		}
	}
}

func TestCancelled_EnsureGuidePrijavaBlocked(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_canc_eg")
	akcija := seedCancelledAkcija(t, db, vodic)
	err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureGuidePrijava(tx, akcija.ID, vodic.ID)
	})
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("expected ErrAkcijaCancelled, got %v", err)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ?", akcija.ID).Count(&n)
	if n != 0 {
		t.Fatal("guide prijava must not be created")
	}
}
