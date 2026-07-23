package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func seedSelfCancelHost(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "vodic"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedSelfCancelAkcija(t *testing.T, db *gorm.DB, owner models.Korisnik, opts ...func(*models.Akcija)) models.Akcija {
	t.Helper()
	a := models.Akcija{
		Naziv: "Self cancel", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	for _, o := range opts {
		o(&a)
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func seedSelfCancelMemberPrijava(t *testing.T, db *gorm.DB, akcijaID uint, username, status string, platio bool) (models.Korisnik, models.Prijava) {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcijaID, KorisnikID: u.ID, Status: status, Platio: platio}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	izbor := models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	if err := db.Create(&izbor).Error; err != nil {
		t.Fatal(err)
	}
	return u, p
}

func countPrijaveByID(t *testing.T, db *gorm.DB, prijavaID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Prijava{}).Where("id = ?", prijavaID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func countIzboriForPrijava(t *testing.T, db *gorm.DB, prijavaID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", prijavaID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func callOtkaziPrijavuWithBody(t *testing.T, db *gorm.DB, akcijaID uint, username string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/prijavi", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	OtkaziPrijavuNaAkciju(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

// pauseBeforeSelfCancelAkcijaLock blocks just before the authoritative Akcija FOR UPDATE.
// Preliminary prijave read has already finished and released its connection, so a competing
// finish/cancel can commit without SQLite connection deadlock.
func pauseBeforeSelfCancelAkcijaLock(t *testing.T, db *gorm.DB, reached chan<- struct{}, cont <-chan struct{}) (cleanup func()) {
	t.Helper()
	var paused int32
	cbName := "sc_before_akcija_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" || !statementHasForUpdate(tx.Statement) {
			return
		}
		if !atomic.CompareAndSwapInt32(&paused, 0, 1) {
			return
		}
		close(reached)
		<-cont
	}); err != nil {
		t.Fatal(err)
	}
	return func() { _ = db.Callback().Query().Remove(cbName) }
}

func pauseAfterSelfCancelAkcijaLock(t *testing.T, db *gorm.DB, locked chan<- struct{}, cont <-chan struct{}) (cleanup func()) {
	t.Helper()
	var paused int32
	cbName := "sc_akcija_lock_" + t.Name()
	if err := db.Callback().Query().After("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" || !statementHasForUpdate(tx.Statement) {
			return
		}
		if !atomic.CompareAndSwapInt32(&paused, 0, 1) {
			return
		}
		close(locked)
		<-cont
	}); err != nil {
		t.Fatal(err)
	}
	return func() { _ = db.Callback().Query().Remove(cbName) }
}

func TestOtkaziPrijavu_ActiveOwnPrijavljen_Success(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_ok_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_ok_m", "prijavljen", false)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["message"] != "Uspešno ste otkazali prijavu" {
		t.Fatalf("message=%v", body["message"])
	}
	if countPrijaveByID(t, db, p.ID) != 0 {
		t.Fatal("prijava must be hard-deleted")
	}
	if countIzboriForPrijava(t, db, p.ID) != 0 {
		t.Fatal("izbori must be deleted")
	}
}

func TestOtkaziPrijavu_PaidActive_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_paid_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_paid_m", "prijavljen", true)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v want 409", code, body)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeSelfCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("paid prijava must remain")
	}
	if countIzboriForPrijava(t, db, p.ID) != 1 {
		t.Fatal("izbori must remain")
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must stay true")
	}
}

func TestOtkaziPrijavu_ForeignPrijava_Rejected(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_fx_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_fx_owner", "prijavljen", false)
	stranger := models.Korisnik{Username: "sc_fx_str", Password: "x", Role: "clan"}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, stranger.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status %d body=%v want 400", code, body)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("foreign prijava must remain")
	}
}

func TestOtkaziPrijavu_NoPrijava_SafeError(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_np_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user := models.Korisnik{Username: "sc_np_u", Password: "x", Role: "clan"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != "Niste bili prijavljeni na ovu akciju" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestOtkaziPrijavu_RelationMismatch_NoMutation(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_mis_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	other := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.Naziv = "Other" })
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_mis_m", "prijavljen", false)

	akcijaLocked := make(chan struct{})
	continueCancel := make(chan struct{})
	cleanup := pauseAfterSelfCancelAkcijaLock(t, db, akcijaLocked, continueCancel)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	}()

	<-akcijaLocked
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("akcija_id", other.ID).Error; err != nil {
		t.Fatal(err)
	}
	close(continueCancel)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v want 409", code, body)
	}
	if body["error"] != helpers.ErrPrijavaAkcijaMismatch.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain on mismatch")
	}
}

func TestOtkaziPrijavu_ForbiddenStatus_NoMutation(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_st_h")
	akcija := seedSelfCancelAkcija(t, db, owner)

	for _, status := range []string{"popeo se", "nije uspeo", "otkazano"} {
		user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_st_"+status, status, false)
		code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
		if code != http.StatusForbidden {
			t.Fatalf("status=%s → http %d body=%v want 403", status, code, body)
		}
		if countPrijaveByID(t, db, p.ID) != 1 {
			t.Fatalf("status=%s prijava must remain", status)
		}
	}
}

func TestOtkaziPrijavu_Completed_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_done_h")
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_done_m", "prijavljen", false)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v want 409", code, body)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_Cancelled_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_canc_h")
	now := time.Now()
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Otkaz"
	})
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_canc_m", "prijavljen", false)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v want 409", code, body)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_ContradictoryCompletedCancelled_PrefersCancelled(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_both_h")
	now := time.Now()
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCompleted = true
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Both"
	})
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_both_m", "prijavljen", false)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%q want cancelled priority", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_StalePreReadActive_LockedCompletedBlocks(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_stale_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_stale_m", "prijavljen", false)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeSelfCancelAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	}()

	<-reached
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}
	fresh := akcija
	if _, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v — must use locked completed, not stale pre-read", code, body)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_StalePreReadPrijavljen_LockedTerminalBlocks(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_term_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_term_m", "prijavljen", false)

	akcijaLocked := make(chan struct{})
	continueCancel := make(chan struct{})
	cleanup := pauseAfterSelfCancelAkcijaLock(t, db, akcijaLocked, continueCancel)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	}()

	<-akcijaLocked
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}
	close(continueCancel)
	wg.Wait()

	if code != http.StatusForbidden {
		t.Fatalf("status %d body=%v want 403 from locked terminal status", code, body)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("must not delete terminal status")
	}
}

func TestOtkaziPrijavu_FinishFirst_SelfCancelConflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_ff_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_ff_m", "prijavljen", false)

	preReadDone := make(chan struct{})
	finishDone := make(chan struct{})
	cleanup := pauseBeforeSelfCancelAkcijaLock(t, db, preReadDone, finishDone)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	}()

	<-preReadDone
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}
	fresh := akcija
	if _, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish first: %v", err)
	}
	close(finishDone)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain after finish-first")
	}
}

func TestOtkaziPrijavu_SelfCancelFirst_FinishUsesNewState(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_sf_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_sf_m", "prijavljen", false)

	code := callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("self-cancel status %d", code)
	}
	if countPrijaveByID(t, db, p.ID) != 0 {
		t.Fatal("prijava must be gone")
	}

	fresh := akcija
	res, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{})
	if err != nil {
		t.Fatalf("finish after self-cancel: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestOtkaziPrijavu_CancelActionFirst_SelfCancelConflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_cf_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_cf_m", "prijavljen", false)

	preReadDone := make(chan struct{})
	cancelDone := make(chan struct{})
	cleanup := pauseBeforeSelfCancelAkcijaLock(t, db, preReadDone, cancelDone)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	}()

	<-preReadDone
	cancelCode, _ := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "Otkaz prije self-cancela",
	})
	if cancelCode != http.StatusOK {
		t.Fatalf("cancel first status %d", cancelCode)
	}
	close(cancelDone)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_SelfCancelFirst_CancelSnapshotExcludesUser(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_sc_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_sc_m", "prijavljen", false)
	other, _ := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_sc_o", "prijavljen", false)

	if callOtkaziPrijavu(t, db, akcija.ID, user.Username) != http.StatusOK {
		t.Fatal("self-cancel failed")
	}
	if countPrijaveByID(t, db, p.ID) != 0 {
		t.Fatal("prijava must be gone")
	}

	result, err := actions.CancelAction(db, akcija.ID, "Validan razlog xx", owner.ID, func(tx *gorm.DB, locked *models.Akcija) error {
		return nil
	})
	if err != nil {
		t.Fatalf("cancel: %v", err)
	}
	for _, id := range result.RecipientUserIDs {
		if id == user.ID {
			t.Fatal("cancelled snapshot must not include self-cancelled user")
		}
	}
	foundOther := false
	for _, id := range result.RecipientUserIDs {
		if id == other.ID {
			foundOther = true
		}
	}
	if !foundOther {
		t.Fatal("remaining participant must be in cancel snapshot")
	}
}

func TestOtkaziPrijavu_ParticipantStatusFirst_UsesLockedStatus(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_ps_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_ps_m", "prijavljen", false)

	akcijaLocked := make(chan struct{})
	continueCancel := make(chan struct{})
	cleanup := pauseAfterSelfCancelAkcijaLock(t, db, akcijaLocked, continueCancel)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code = callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	}()

	<-akcijaLocked
	// Direct row update simulates host status commit that raced ahead; HTTP status
	// would deadlock waiting for the same Akcija FOR UPDATE held by self-cancel.
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "nije uspeo").Error; err != nil {
		t.Fatal(err)
	}
	close(continueCancel)
	wg.Wait()

	if code != http.StatusForbidden {
		t.Fatalf("status %d want 403 using locked terminal status", code)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.Status != "nije uspeo" {
		t.Fatalf("status=%s", reloaded.Status)
	}
}

func TestOtkaziPrijavu_SelfCancelFirst_StatusUpdateSafeNotFound(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_su_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_su_m", "prijavljen", false)

	if callOtkaziPrijavu(t, db, akcija.ID, user.Username) != http.StatusOK {
		t.Fatal("self-cancel failed")
	}
	code, body := callUpdatePrijavaStatus(t, db, p.ID, "popeo se", owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%v want 404 (no 500)", code, body)
	}
	if code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestOtkaziPrijavu_LockOrderAkcijaThenPrijava(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_ord_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, _ := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_ord_m", "prijavljen", false)

	var order []string
	var mu sync.Mutex
	cbName := "sc_lock_order_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || !statementHasForUpdate(tx.Statement) {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		switch tx.Statement.Table {
		case "akcije":
			order = append(order, "akcija")
		case "prijave":
			order = append(order, "prijava")
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })

	code := callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(order) < 2 || order[0] != "akcija" || order[1] != "prijava" {
		t.Fatalf("lock order=%v want akcija→prijava", order)
	}
	for i := 1; i < len(order); i++ {
		if order[i] == "akcija" && order[i-1] == "prijava" {
			t.Fatalf("found Prijava→Akcija inversion in %v", order)
		}
	}
}

func TestOtkaziPrijavu_DeleteIzboriError_Rollback(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_rb_iz_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_rb_iz_m", "prijavljen", false)

	cbName := "sc_izbori_fail_" + t.Name()
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijava_izbori" {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Delete().Remove(cbName) })

	code := callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain after izbori delete failure")
	}
	if countIzboriForPrijava(t, db, p.ID) != 1 {
		t.Fatal("izbori must rollback")
	}
}

func TestOtkaziPrijavu_DeletePrijavaError_Rollback(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_rb_pr_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_rb_pr_m", "prijavljen", false)

	cbName := "sc_prijava_fail_" + t.Name()
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijave" {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Delete().Remove(cbName) })

	code := callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
	if countIzboriForPrijava(t, db, p.ID) != 1 {
		t.Fatal("izbori must remain when prijava delete fails first")
	}
}

func TestOtkaziPrijavu_GuardConflict_NoDelete(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_gd_h")
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_gd_m", "prijavljen", false)

	var deletes int32
	cbName := "sc_no_del_" + t.Name()
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil {
			return
		}
		if tx.Statement.Table == "prijave" || tx.Statement.Table == "prijava_izbori" {
			atomic.AddInt32(&deletes, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Delete().Remove(cbName) })

	code := callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if atomic.LoadInt32(&deletes) != 0 {
		t.Fatalf("expected no deletes after guard, got %d", deletes)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}
