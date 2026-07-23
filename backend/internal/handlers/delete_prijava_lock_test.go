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

func callDeletePrijava(t *testing.T, db *gorm.DB, prijavaID uint, username, role string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/prijave/"+strconv.FormatUint(uint64(prijavaID), 10), nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijavaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	DeletePrijava(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func pauseBeforeHostDeleteAkcijaLock(t *testing.T, db *gorm.DB, reached chan<- struct{}, cont <-chan struct{}) func() {
	t.Helper()
	var paused int32
	cbName := "hd_before_akcija_" + t.Name()
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

func pauseAfterHostDeleteAkcijaLock(t *testing.T, db *gorm.DB, locked chan<- struct{}, cont <-chan struct{}) func() {
	t.Helper()
	var paused int32
	cbName := "hd_after_akcija_" + t.Name()
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

func TestDeletePrijava_ActiveUnpaid_Success(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_ok_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_ok_m", "prijavljen", false)

	code, body := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if countPrijaveByID(t, db, p.ID) != 0 {
		t.Fatal("prijava must be deleted")
	}
	if countIzboriForPrijava(t, db, p.ID) != 0 {
		t.Fatal("izbori must be deleted")
	}
}

func TestDeletePrijava_Unauthorized_Forbidden(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_un_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_un_m", "prijavljen", false)
	stranger := models.Korisnik{Username: "hd_un_str", Password: "x", Role: "clan"}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeletePrijava(t, db, p.ID, stranger.Username, "clan")
	if code != http.StatusForbidden {
		t.Fatalf("status %d want 403", code)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_NotFound(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_nf_h")
	code, body := callDeletePrijava(t, db, 99999, owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%v", code, body)
	}
	if code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestDeletePrijava_RelationMismatch_NoMutation(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_mis_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	other := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.Naziv = "Other" })
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_mis_m", "prijavljen", false)

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterHostDeleteAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	}()

	<-locked
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("akcija_id", other.ID).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrPrijavaAkcijaMismatch.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_TerminalStatus_Blocked(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_term_h")
	akcija := seedSelfCancelAkcija(t, db, owner)

	for _, status := range []string{"popeo se", "nije uspeo", "otkazano"} {
		_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_term_"+status, status, false)
		code, body := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
		if code != http.StatusConflict {
			t.Fatalf("status=%s → http %d body=%v want 409", status, code, body)
		}
		if body["error"] != helpers.ErrHostDeletePrijavaStatusForbidden.Error() {
			t.Fatalf("status=%s error=%v", status, body["error"])
		}
		if countPrijaveByID(t, db, p.ID) != 1 {
			t.Fatalf("status=%s prijava must remain", status)
		}
	}
}

func TestDeletePrijava_Completed_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_done_h")
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_done_m", "prijavljen", false)

	code, body := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_Cancelled_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_canc_h")
	now := time.Now()
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Otkaz"
	})
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_canc_m", "prijavljen", false)

	code, body := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_ContradictoryCompletedCancelled_PrefersCancelled(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_both_h")
	now := time.Now()
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCompleted = true
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Both"
	})
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_both_m", "prijavljen", false)

	code, body := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
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

func TestDeletePrijava_StaleActive_LockedCompletedBlocks(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_stale_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_stale_m", "prijavljen", false)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeHostDeleteAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
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
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_Paid_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_paid_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_paid_m", "prijavljen", true)

	code, body := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeDeleted.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 || countIzboriForPrijava(t, db, p.ID) != 1 {
		t.Fatal("rows must remain")
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must stay true")
	}
}

func TestDeletePrijava_StaleUnpaid_LockedPaidBlocks(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_st_up_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_st_up_m", "prijavljen", false)

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterHostDeleteAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	}()

	<-locked
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("platio", true).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeDeleted.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_StalePaid_LockedUnpaidAllowsDelete(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_st_pu_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_st_pu_m", "prijavljen", true)

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterHostDeleteAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	}()

	<-locked
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("platio", false).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusOK {
		t.Fatalf("status %d — locked unpaid must allow delete", code)
	}
	if countPrijaveByID(t, db, p.ID) != 0 {
		t.Fatal("prijava must be deleted")
	}
}

func TestDeletePrijava_PaidGuard_NoDeleteCalls(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_nd_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_nd_m", "prijavljen", true)

	var deletes int32
	cbName := "hd_paid_no_del_" + t.Name()
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

	code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if atomic.LoadInt32(&deletes) != 0 {
		t.Fatalf("expected no deletes, got %d", deletes)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_AuthOnLockedAction_RevokedOwnership(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_auth_h")
	other := seedSelfCancelHost(t, db, "hd_auth_o")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_auth_m", "prijavljen", false)

	var sawAkcijaLock int32
	cbObs := "hd_auth_obs_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbObs, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "akcije" && statementHasForUpdate(tx.Statement) {
			atomic.StoreInt32(&sawAkcijaLock, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbObs) })

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeHostDeleteAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	}()

	<-reached
	// Transfer ownership before authoritative lock/read so CanManage uses locked new state.
	if err := db.Model(&models.Akcija{}).Where("id = ?", akcija.ID).Updates(map[string]any{
		"vodic_id":    other.ID,
		"added_by_id": other.ID,
	}).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if atomic.LoadInt32(&sawAkcijaLock) == 0 {
		t.Fatal("expected Akcija FOR UPDATE as part of authoritative path")
	}
	if code != http.StatusForbidden {
		t.Fatalf("status %d want 403 after locked ownership change", code)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_FinishFirst_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_ff_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_ff_m", "prijavljen", false)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeHostDeleteAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
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
		t.Fatalf("status %d", code)
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_DeleteFirst_FinishUsesNewState(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_df_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_df_m", "prijavljen", false)

	code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("delete status %d", code)
	}
	fresh := akcija
	res, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{})
	if err != nil {
		t.Fatalf("finish after delete: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestDeletePrijava_CancelFirst_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_cf_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_cf_m", "prijavljen", false)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeHostDeleteAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	}()

	<-reached
	cancelCode, _ := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "Otkaz prije host delete",
	})
	if cancelCode != http.StatusOK {
		t.Fatalf("cancel %d", cancelCode)
	}
	close(cont)
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

func TestDeletePrijava_DeleteFirst_CancelSnapshotExcludesUser(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_sc_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_sc_m", "prijavljen", false)
	other, _ := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_sc_o", "prijavljen", false)

	if code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic"); code != http.StatusOK {
		t.Fatal("delete failed")
	}

	result, err := actions.CancelAction(db, akcija.ID, "Validan razlog xx", owner.ID, func(tx *gorm.DB, locked *models.Akcija) error {
		return nil
	})
	if err != nil {
		t.Fatalf("cancel: %v", err)
	}
	for _, id := range result.RecipientUserIDs {
		if id == user.ID {
			t.Fatal("deleted user must not be in cancel snapshot")
		}
	}
	found := false
	for _, id := range result.RecipientUserIDs {
		if id == other.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("remaining participant must be in snapshot")
	}
}

func TestDeletePrijava_MarkPaidFirst_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_mp_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_mp_m", "prijavljen", false)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeHostDeleteAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	}()

	<-reached
	paidCode, _ := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if paidCode != http.StatusOK {
		t.Fatalf("mark-paid %d", paidCode)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeDeleted.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must stay true")
	}
}

func TestDeletePrijava_DeleteUnpaidFirst_MarkPaidNotFound(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_dmp_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_dmp_m", "prijavljen", false)

	if code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic"); code != http.StatusOK {
		t.Fatal("delete failed")
	}
	code, body := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%v", code, body)
	}
	if code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestDeletePrijava_TerminalStatusFirst_Blocked(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "hd_ts_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_ts_m", "prijavljen", false)

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterHostDeleteAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	}()

	<-locked
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "nije uspeo").Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrHostDeletePrijavaStatusForbidden.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestDeletePrijava_DeleteFirst_StatusUpdateNotFound(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_su_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_su_m", "prijavljen", false)

	if code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic"); code != http.StatusOK {
		t.Fatal("delete failed")
	}
	code, body := callUpdatePrijavaStatus(t, db, p.ID, "popeo se", owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%v", code, body)
	}
	if code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestDeletePrijava_LockOrderAkcijaThenPrijava(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_ord_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_ord_m", "prijavljen", false)

	var order []string
	var mu sync.Mutex
	cbName := "hd_lock_order_" + t.Name()
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

	code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
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

func TestDeletePrijava_DeleteIzboriError_Rollback(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_rb_iz_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_rb_iz_m", "prijavljen", false)

	cbName := "hd_izbori_fail_" + t.Name()
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijava_izbori" {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Delete().Remove(cbName) })

	code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPrijaveByID(t, db, p.ID) != 1 || countIzboriForPrijava(t, db, p.ID) != 1 {
		t.Fatal("both rows must remain after rollback")
	}
}

func TestDeletePrijava_DeletePrijavaError_Rollback(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_rb_pr_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_rb_pr_m", "prijavljen", false)

	cbName := "hd_prijava_fail_" + t.Name()
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijave" {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Delete().Remove(cbName) })

	code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPrijaveByID(t, db, p.ID) != 1 || countIzboriForPrijava(t, db, p.ID) != 1 {
		t.Fatal("izbori must rollback with prijava")
	}
}

func TestDeletePrijava_GuardError_NoDelete(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "hd_gd_h")
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })
	_, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "hd_gd_m", "prijavljen", false)

	var deletes int32
	cbName := "hd_guard_no_del_" + t.Name()
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

	code, _ := callDeletePrijava(t, db, p.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if atomic.LoadInt32(&deletes) != 0 {
		t.Fatalf("expected no deletes, got %d", deletes)
	}
}
