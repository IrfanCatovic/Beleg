package handlers

import (
	"bytes"
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
	"gorm.io/gorm/clause"
)

func callUpdatePrijavaPlatio(t *testing.T, db *gorm.DB, prijavaID uint, platio bool, username, role string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	raw, _ := json.Marshal(map[string]bool{"platio": platio})
	c.Request = httptest.NewRequest(http.MethodPatch, "/prijave/"+strconv.FormatUint(uint64(prijavaID), 10)+"/platio", bytes.NewReader(raw))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijavaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	UpdatePrijavaPlatioStatus(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func seedPlatioHostAction(t *testing.T, db *gorm.DB, username string, completed, cancelled bool) (models.Korisnik, models.Akcija) {
	t.Helper()
	owner := models.Korisnik{Username: username, Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Platio guard", Datum: time.Now().Add(-24 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
		CenaClan: 100, IsCompleted: completed, IsCancelled: cancelled,
	}
	if cancelled {
		now := time.Now()
		akcija.CancelledAt = &now
		akcija.CancellationReason = "Test otkaz"
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	return owner, akcija
}

func seedPlatioMember(t *testing.T, db *gorm.DB, akcijaID uint, username, status string, platio bool) models.Prijava {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcijaID, KorisnikID: u.ID, Status: status, Platio: platio}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func statementHasForUpdate(stmt *gorm.Statement) bool {
	if stmt == nil {
		return false
	}
	for _, c := range stmt.Clauses {
		if locking, ok := c.Expression.(clause.Locking); ok && locking.Strength == "UPDATE" {
			return true
		}
	}
	return false
}

func TestUpdatePrijavaPlatio_CompletedTrueToFalse_Conflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_c_tt", true, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_c_mem", "popeo se", true)

	code, body := callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v want 409", code, body)
	}
	if body["error"] != helpers.ErrCompletedActionPaymentCannotBeUnset.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !reloaded.Platio {
		t.Fatal("Platio must stay true")
	}
}

func TestUpdatePrijavaPlatio_StalePreReadActive_LockedCompletedBlocksUnpay(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner, akcija := seedPlatioHostAction(t, db, "pl_stale", false, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_stale_m", "popeo se", true)

	preReadDone := make(chan struct{})
	finishDone := make(chan struct{})
	var once sync.Once
	cbName := "platio_stale_preread_" + t.Name()
	if err := db.Callback().Query().After("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" {
			return
		}
		if statementHasForUpdate(tx.Statement) {
			return
		}
		once.Do(func() {
			close(preReadDone)
			<-finishDone
		})
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	}()

	<-preReadDone
	fresh := akcija
	actor := owner
	if _, err := actions.FinishAction(db, &fresh, actor, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	close(finishDone)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v — must use locked completed state, not stale pre-read", code, body)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !reloaded.Platio {
		t.Fatal("Platio must stay true after finish-then-unpay race")
	}
}

func TestUpdatePrijavaPlatio_StalePreReadUnpaid_LockedPaidBlocksUnpayOnCompleted(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner, akcija := seedPlatioHostAction(t, db, "pl_stale_p", true, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_stale_pm", "popeo se", false)

	preReadDone := make(chan struct{})
	markPaidDone := make(chan struct{})
	var once sync.Once
	cbName := "platio_stale_platio_" + t.Name()
	if err := db.Callback().Query().After("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "prijave" {
			return
		}
		if statementHasForUpdate(tx.Statement) {
			return
		}
		once.Do(func() {
			close(preReadDone)
			<-markPaidDone
		})
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	}()

	<-preReadDone
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("platio", true).Error; err != nil {
		t.Fatal(err)
	}
	close(markPaidDone)
	wg.Wait()

	// Requested false + locked true + completed → conflict (not idempotent false→false).
	if code != http.StatusConflict {
		t.Fatalf("status %d want 409 based on locked Platio=true", code)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !reloaded.Platio {
		t.Fatal("Platio must remain true")
	}
}

func TestUpdatePrijavaPlatio_RelationMismatch_NoUpdate(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner, akcija := seedPlatioHostAction(t, db, "pl_mis", false, false)
	other := models.Akcija{
		Naziv: "Other", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPlatioMember(t, db, akcija.ID, "pl_mis_m", "prijavljen", true)

	akcijaLocked := make(chan struct{})
	continueUpdate := make(chan struct{})
	var once sync.Once
	cbName := "platio_mismatch_" + t.Name()
	if err := db.Callback().Query().After("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" {
			return
		}
		if !statementHasForUpdate(tx.Statement) {
			return
		}
		once.Do(func() {
			close(akcijaLocked)
			<-continueUpdate
		})
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	}()

	<-akcijaLocked
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("akcija_id", other.ID).Error; err != nil {
		t.Fatal(err)
	}
	close(continueUpdate)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d want 409 mismatch", code)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.AkcijaID != other.ID {
		t.Fatalf("akcija_id=%d", reloaded.AkcijaID)
	}
	if !reloaded.Platio {
		t.Fatal("Platio must not change on mismatch")
	}
}

func TestUpdatePrijavaPlatio_ActiveTransitions(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_act", false, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_act_m", "prijavljen", true)

	code, _ := callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("active true→false status %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected false")
	}

	code, _ = callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("active false→true status %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected true")
	}
}

func TestUpdatePrijavaPlatio_CompletedAllowedTransitions(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_comp_ok", true, false)
	pFalse := seedPlatioMember(t, db, akcija.ID, "pl_comp_f", "popeo se", false)
	pTrue := seedPlatioMember(t, db, akcija.ID, "pl_comp_t", "popeo se", true)

	code, body := callUpdatePrijavaPlatio(t, db, pFalse.ID, true, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("completed false→true status %d body=%v", code, body)
	}
	if !getPrijavaPlatio(t, db, pFalse.ID) {
		t.Fatal("expected Platio=true")
	}

	code, body = callUpdatePrijavaPlatio(t, db, pTrue.ID, true, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("completed true→true status %d body=%v", code, body)
	}
	if !getPrijavaPlatio(t, db, pTrue.ID) {
		t.Fatal("expected Platio still true")
	}

	code, _ = callUpdatePrijavaPlatio(t, db, pFalse.ID, true, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("idempotent completed true→true after pay %d", code)
	}
}

func TestUpdatePrijavaPlatio_CancelledBlocked(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_canc", false, true)
	p := seedPlatioMember(t, db, akcija.ID, "pl_canc_m", "prijavljen", true)

	code, body := callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio unchanged")
	}
}

func TestUpdatePrijavaPlatio_FinishFirstThenUnpay(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_fin1", false, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_fin1_m", "popeo se", true)

	fresh := akcija
	if _, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	var txCount int64
	if err := db.Model(&models.Transakcija{}).Count(&txCount).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("unpay after finish status %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must stay true")
	}
	var txCount2 int64
	if err := db.Model(&models.Transakcija{}).Count(&txCount2).Error; err != nil {
		t.Fatal(err)
	}
	if txCount2 != txCount {
		t.Fatalf("transakcije changed %d → %d", txCount, txCount2)
	}
}

func TestUpdatePrijavaPlatio_UnpayFirstThenFinish(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_unp1", false, false)
	akcija.CenaClan = 50
	if err := db.Save(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	p := seedPlatioMember(t, db, akcija.ID, "pl_unp1_m", "popeo se", true)

	code, _ := callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("unpay while active status %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false")
	}

	fresh := akcija
	res, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{})
	if err != nil {
		t.Fatalf("finish after unpay: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("finish must not revive Platio")
	}
}

func TestUpdatePrijavaPlatio_ParallelTrueFalse(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner, akcija := seedPlatioHostAction(t, db, "pl_par", false, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_par_m", "prijavljen", false)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i, want := range []bool{true, false} {
		wg.Add(1)
		go func(idx int, platio bool) {
			defer wg.Done()
			codes[idx], _ = callUpdatePrijavaPlatio(t, db, p.ID, platio, owner.Username, "vodic")
		}(i, want)
	}
	wg.Wait()

	for i, code := range codes {
		if code != http.StatusOK && code != http.StatusConflict {
			t.Fatalf("codes[%d]=%d unexpected", i, code)
		}
		if code >= 500 {
			t.Fatalf("must not 500: %v", codes)
		}
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	// Final state is whichever txn committed last; must be a valid bool, not corrupted.
	_ = reloaded.Platio
}

func TestUpdatePrijavaPlatio_LockOrderAkcijaThenPrijava(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_ord", false, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_ord_m", "prijavljen", false)

	var order []string
	var mu sync.Mutex
	cbName := "platio_lock_order_" + t.Name()
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

	code, _ := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
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

func TestUpdatePrijavaPlatio_GuardConflict_NoSave(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_nosave", true, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_nosave_m", "popeo se", true)

	var updates int32
	cbName := "platio_no_save_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijave" {
			atomic.AddInt32(&updates, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, _ := callUpdatePrijavaPlatio(t, db, p.ID, false, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if atomic.LoadInt32(&updates) != 0 {
		t.Fatalf("expected no prijave UPDATE after guard, got %d", updates)
	}
}

func TestUpdatePrijavaPlatio_UpdateError_Rollback(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner, akcija := seedPlatioHostAction(t, db, "pl_rb", false, false)
	p := seedPlatioMember(t, db, akcija.ID, "pl_rb_m", "prijavljen", false)

	cbName := "platio_save_fail_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijave" {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, _ := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must remain false after rollback")
	}
}
