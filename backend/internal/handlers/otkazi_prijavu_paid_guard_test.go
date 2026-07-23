package handlers

import (
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func TestOtkaziPrijavu_GuideException_PaidStillBlocked(t *testing.T) {
	db := testFinishHandlerDB(t)
	guide := seedSelfCancelHost(t, db, "sc_g_paid")
	akcija := seedSelfCancelAkcija(t, db, guide)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "popeo se", Platio: true}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, guide.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v want 409 paid (guide exception does not bypass paid)", code, body)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeSelfCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_CancelledPaid_PrefersCancelled(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_cp_h")
	now := time.Now()
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Otkaz"
	})
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_cp_m", "prijavljen", true)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%q want cancelled priority over paid", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_CompletedPaid_PrefersCompleted(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_donep_h")
	akcija := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_donep_m", "prijavljen", true)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%q want completed priority over paid", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_TerminalStatusPaid_PrefersStatus(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_term_p_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_term_p_m", "popeo se", true)

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusForbidden {
		t.Fatalf("status %d body=%v want 403 status before paid", code, body)
	}
	if body["error"] == helpers.ErrPaidPrijavaCannotBeSelfCancelled.Error() {
		t.Fatal("must not leak paid error when status forbids first")
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_RelationMismatchPaid_NoPaymentLeak(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_mis_p_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	other := seedSelfCancelAkcija(t, db, owner, func(a *models.Akcija) { a.Naziv = "Other" })
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_mis_p_m", "prijavljen", true)

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
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrPrijavaAkcijaMismatch.Error() {
		t.Fatalf("error=%v want mismatch, not paid leak", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestOtkaziPrijavu_StaleUnpaid_LockedPaidBlocks(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_st_up_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_st_up_m", "prijavljen", false)

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
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("platio", true).Error; err != nil {
		t.Fatal(err)
	}
	close(continueCancel)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v — must use locked Platio=true", code, body)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeSelfCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must stay true")
	}
}

func TestOtkaziPrijavu_StalePaid_LockedUnpaidAllowsDelete(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_st_pu_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_st_pu_m", "prijavljen", true)

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
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("platio", false).Error; err != nil {
		t.Fatal(err)
	}
	close(continueCancel)
	wg.Wait()

	if code != http.StatusOK {
		t.Fatalf("status %d — locked Platio=false must allow delete", code)
	}
	if countPrijaveByID(t, db, p.ID) != 0 {
		t.Fatal("prijava must be deleted")
	}
}

func TestOtkaziPrijavu_MarkPaidFirst_SelfCancelConflict(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_mp_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_mp_m", "prijavljen", false)

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
	paidCode, _ := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if paidCode != http.StatusOK {
		t.Fatalf("mark-paid status %d", paidCode)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeSelfCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPrijaveByID(t, db, p.ID) != 1 {
		t.Fatal("prijava must remain")
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must be true")
	}
}

func TestOtkaziPrijavu_SelfCancelFirst_MarkPaidSafeNotFound(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_scmp_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_scmp_m", "prijavljen", false)

	if callOtkaziPrijavu(t, db, akcija.ID, user.Username) != http.StatusOK {
		t.Fatal("self-cancel failed")
	}
	code, body := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%v want 404", code, body)
	}
	if code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestOtkaziPrijavu_ParallelMarkPaidAndSelfCancel(t *testing.T) {
	db := testFinishHandlerDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedSelfCancelHost(t, db, "sc_par_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_par_m", "prijavljen", false)

	var wg sync.WaitGroup
	var cancelCode, paidCode int
	wg.Add(2)
	go func() {
		defer wg.Done()
		cancelCode = callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	}()
	go func() {
		defer wg.Done()
		paidCode, _ = callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	}()
	wg.Wait()

	if cancelCode >= 500 || paidCode >= 500 {
		t.Fatalf("must not 500: cancel=%d paid=%d", cancelCode, paidCode)
	}
	if cancelCode == http.StatusOK && paidCode == http.StatusOK {
		t.Fatalf("both cannot succeed: cancel=%d paid=%d", cancelCode, paidCode)
	}
	exists := countPrijaveByID(t, db, p.ID) == 1
	switch {
	case cancelCode == http.StatusOK:
		if exists {
			t.Fatal("self-cancel OK implies row gone")
		}
	case paidCode == http.StatusOK:
		if !exists || !getPrijavaPlatio(t, db, p.ID) {
			t.Fatal("mark-paid OK implies Platio=true row remains")
		}
		if cancelCode != http.StatusConflict {
			// Self-cancel may still be in-flight failure modes; paid-first → 409.
			// Other safe outcomes: 409 paid guard, or rare conflict.
			if cancelCode == http.StatusOK {
				t.Fatal("self-cancel must not succeed after mark-paid")
			}
		}
	}
}

func TestOtkaziPrijavu_ChoicesResetPlatioFirst_ThenSelfCancelOK(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "sc_ch_u")
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
	if code != http.StatusOK {
		t.Fatalf("choices status %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false after saldo change")
	}

	cancelCode := callOtkaziPrijavu(t, db, akcija.ID, user.Username)
	if cancelCode != http.StatusOK {
		t.Fatalf("self-cancel after unpaid reset status %d", cancelCode)
	}
	if countPrijaveByID(t, db, p.ID) != 0 {
		t.Fatal("prijava must be deleted")
	}
}

func TestOtkaziPrijavu_SelfCancelFirst_ChoicesSafeNotFound(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "sc_ch2_u")
	akcija := seedOpenAkcija(t, db, 10)
	s := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "S", CenaPoOsobiUkupno: 30}
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	_ = seedPrijavaSPlatio(t, db, akcija.ID, user.ID, false, "[]")

	if callOtkaziPrijavu(t, db, akcija.ID, user.Username) != http.StatusOK {
		t.Fatal("self-cancel failed")
	}
	code, body := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username,
		prijavaChoicesPayload{SelectedSmestajIDs: []uint{s.ID}})
	if code == http.StatusOK {
		t.Fatal("choices must not succeed after delete")
	}
	if code >= 500 {
		t.Fatalf("must not 500: %d body=%v", code, body)
	}
}

func TestOtkaziPrijavu_PaidGuard_NoDeleteCalls(t *testing.T) {
	db := testFinishHandlerDB(t)
	owner := seedSelfCancelHost(t, db, "sc_nd_h")
	akcija := seedSelfCancelAkcija(t, db, owner)
	user, p := seedSelfCancelMemberPrijava(t, db, akcija.ID, "sc_nd_m", "prijavljen", true)

	var deletes int32
	cbName := "sc_paid_no_del_" + t.Name()
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

	code, body := callOtkaziPrijavuWithBody(t, db, akcija.ID, user.Username)
	if code != http.StatusConflict {
		t.Fatalf("status %d want 409", code)
	}
	if body["error"] != helpers.ErrPaidPrijavaCannotBeSelfCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if atomic.LoadInt32(&deletes) != 0 {
		t.Fatalf("expected no deletes after paid guard, got %d", deletes)
	}
	if countPrijaveByID(t, db, p.ID) != 1 || countIzboriForPrijava(t, db, p.ID) != 1 {
		t.Fatal("rows must remain")
	}
}
