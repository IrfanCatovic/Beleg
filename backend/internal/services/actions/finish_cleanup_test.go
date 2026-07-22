package actions

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func seedFinishSignup(t *testing.T, db *gorm.DB, akcijaID, requesterID uint, status string) models.ActionSignupRequest {
	t.Helper()
	req := models.ActionSignupRequest{
		AkcijaID: akcijaID, RequesterID: requesterID, Status: status,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	if status != models.ActionSignupRequestPending {
		now := time.Now().Add(-time.Hour)
		req.RespondedAt = &now
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}
	return req
}

func seedFinishInvite(t *testing.T, db *gorm.DB, akcijaID uint, hash string, revokedAt *time.Time, expiresAt *time.Time) models.ActionInviteLink {
	t.Helper()
	link := models.ActionInviteLink{
		AkcijaID: akcijaID, TokenHash: hash, RevokedAt: revokedAt, ExpiresAt: expiresAt,
	}
	if err := db.Create(&link).Error; err != nil {
		t.Fatal(err)
	}
	return link
}

func reloadSignup(t *testing.T, db *gorm.DB, id uint) models.ActionSignupRequest {
	t.Helper()
	var req models.ActionSignupRequest
	if err := db.First(&req, id).Error; err != nil {
		t.Fatal(err)
	}
	return req
}

func reloadInvite(t *testing.T, db *gorm.DB, id uint) models.ActionInviteLink {
	t.Helper()
	var link models.ActionInviteLink
	if err := db.First(&link, id).Error; err != nil {
		t.Fatal(err)
	}
	return link
}

func TestFinishCleanup_OnePendingCancelled(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_cl1")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_cl1", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("completed")
	}
	got := reloadSignup(t, db, req.ID)
	if got.Status != models.ActionSignupRequestCancelled {
		t.Fatalf("status=%s", got.Status)
	}
	if got.RespondedAt == nil {
		t.Fatal("RespondedAt")
	}
	if got.ReviewedByID != nil {
		t.Fatal("ReviewedByID nil")
	}
}

func TestFinishCleanup_TenPending_BulkUpdate(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_cl10")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	var updates int32
	cbName := "count_signup_bulk_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_signup_requests" {
			atomic.AddInt32(&updates, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	for i := 0; i < 10; i++ {
		u := models.Korisnik{Username: "u10_" + string(rune('a'+i)), Password: "x", Role: "clan"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	}

	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt32(&updates) != 1 {
		t.Fatalf("expected 1 bulk update, got %d", updates)
	}
	var pending int64
	db.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND status = ?", akcija.ID, models.ActionSignupRequestPending).
		Count(&pending)
	if pending != 0 {
		t.Fatal("no pending left")
	}
	var cancelled int64
	db.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND status = ?", akcija.ID, models.ActionSignupRequestCancelled).
		Count(&cancelled)
	if cancelled != 10 {
		t.Fatalf("cancelled=%d", cancelled)
	}
}

func TestFinishCleanup_TerminalStatusesUntouched(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_term")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	statuses := []string{
		models.ActionSignupRequestAccepted,
		models.ActionSignupRequestRejected,
		models.ActionSignupRequestCancelled,
	}
	ids := make([]uint, len(statuses))
	for i, st := range statuses {
		u := models.Korisnik{Username: "term_" + st, Password: "x", Role: "clan"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		ids[i] = seedFinishSignup(t, db, akcija.ID, u.ID, st).ID
	}

	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	for i, st := range statuses {
		got := reloadSignup(t, db, ids[i])
		if got.Status != st {
			t.Fatalf("%s changed to %s", st, got.Status)
		}
	}
}

func TestFinishCleanup_NoRequests_OK(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_none")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if !reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("completed")
	}
}

func TestFinishCleanup_ManyPending_SingleBulk(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_500")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	const n = 100 // dovoljno za bulk/N+1 regresiju bez sporog testa
	var updates int32
	cbName := "count_bulk_many_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_signup_requests" {
			atomic.AddInt32(&updates, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	for i := 0; i < n; i++ {
		u := models.Korisnik{Username: fmt.Sprintf("many_%s_%d", t.Name(), i), Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatalf("user %d: %v", i, err)
		}
		seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	}

	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt32(&updates) != 1 {
		t.Fatalf("expected 1 bulk update, got %d (N+1?)", updates)
	}
	var cancelled int64
	db.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND status = ?", akcija.ID, models.ActionSignupRequestCancelled).
		Count(&cancelled)
	if cancelled != n {
		t.Fatalf("cancelled=%d want %d", cancelled, n)
	}
}

func TestFinishCleanup_InviteRevoke(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_inv")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	oldRevoke := time.Now().Add(-48 * time.Hour)
	active := seedFinishInvite(t, db, akcija.ID, "hash-active-1", nil, nil)
	active2 := seedFinishInvite(t, db, akcija.ID, "hash-active-2", nil, nil)
	already := seedFinishInvite(t, db, akcija.ID, "hash-revoked", &oldRevoke, nil)
	expired := time.Now().Add(-time.Hour)
	expiredActive := seedFinishInvite(t, db, akcija.ID, "hash-expired", nil, &expired)

	var inviteUpdates int32
	cbName := "count_invite_bulk_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_invite_links" {
			atomic.AddInt32(&inviteUpdates, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt32(&inviteUpdates) != 1 {
		t.Fatalf("expected 1 invite bulk update, got %d", inviteUpdates)
	}
	for _, id := range []uint{active.ID, active2.ID, expiredActive.ID} {
		got := reloadInvite(t, db, id)
		if got.RevokedAt == nil {
			t.Fatalf("link %d must be revoked", id)
		}
	}
	gotAlready := reloadInvite(t, db, already.ID)
	if gotAlready.RevokedAt == nil || !gotAlready.RevokedAt.Equal(oldRevoke) {
		t.Fatalf("already-revoked timestamp changed: %v vs %v", gotAlready.RevokedAt, oldRevoke)
	}
}

func TestFinishCleanup_UnresolvedParticipant_RollsBackCleanup(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_rb_u")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_rb", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	inv := seedFinishInvite(t, db, akcija.ID, "hash-rb-u", nil, nil)
	seedFinishPrijava(t, db, akcija.ID, "mem_unresolved", "prijavljen", false)

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaHasUnresolvedParticipants) {
		t.Fatalf("expected unresolved, got %v", err)
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("not completed")
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("signup rollback to pending")
	}
	if reloadInvite(t, db, inv.ID).RevokedAt != nil {
		t.Fatal("invite rollback active")
	}
}

func TestFinishCleanup_FinanceError_RollsBackCleanup(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_rb_f")
	klubID := uint(42)
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) {
		a.VodicID = 0
		a.OrganizatorTip = "klub"
		a.KlubID = &klubID
		a.CenaClan = 100
	})
	u := models.Korisnik{Username: "u_fin", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	inv := seedFinishInvite(t, db, akcija.ID, "hash-rb-f", nil, nil)
	p := seedFinishPrijava(t, db, akcija.ID, "paid_mem", "popeo se", true)
	_ = p

	cbName := "fail_tx_create_" + t.Name()
	if err := db.Callback().Create().Before("gorm:create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "transakcije" {
			_ = tx.AddError(errors.New("forced finance failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err == nil {
		t.Fatal("expected finance failure")
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("not completed")
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("signup pending after rollback")
	}
	if reloadInvite(t, db, inv.ID).RevokedAt != nil {
		t.Fatal("invite active after rollback")
	}
	if countTransakcije(t, db) != 0 {
		t.Fatal("no transakcija")
	}
}

func TestFinishCleanup_SignupUpdateError_RollsBack(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_rb_s")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_sfail", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	inv := seedFinishInvite(t, db, akcija.ID, "hash-sfail", nil, nil)

	cbName := "fail_signup_upd_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_signup_requests" {
			_ = tx.AddError(errors.New("forced signup cleanup failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err == nil {
		t.Fatal("expected signup cleanup failure")
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("not completed")
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("pending")
	}
	if reloadInvite(t, db, inv.ID).RevokedAt != nil {
		t.Fatal("invite not touched")
	}
}

func TestFinishCleanup_InviteUpdateError_RollsBackSignup(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_rb_i")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_ifail", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	_ = seedFinishInvite(t, db, akcija.ID, "hash-ifail", nil, nil)

	cbName := "fail_invite_upd_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_invite_links" {
			_ = tx.AddError(errors.New("forced invite revoke failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err == nil {
		t.Fatal("expected invite failure")
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("signup must rollback to pending")
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("not completed")
	}
}

func TestFinishCleanup_LockOrder(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_ord")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_ord", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)

	var events []string
	var mu sync.Mutex
	cbQ := "ord_q_" + t.Name()
	cbU := "ord_u_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbQ, func(gdb *gorm.DB) {
		if gdb.Statement == nil {
			return
		}
		if _, ok := gdb.Statement.Clauses["FOR"]; !ok {
			return
		}
		table := gdb.Statement.Table
		if table == "" && gdb.Statement.Schema != nil {
			table = gdb.Statement.Schema.Table
		}
		mu.Lock()
		events = append(events, "lock:"+table)
		mu.Unlock()
	}); err != nil {
		t.Fatal(err)
	}
	if err := db.Callback().Update().Before("gorm:update").Register(cbU, func(gdb *gorm.DB) {
		if gdb.Statement == nil {
			return
		}
		table := gdb.Statement.Table
		if table == "action_signup_requests" || table == "action_invite_links" {
			mu.Lock()
			events = append(events, "upd:"+table)
			mu.Unlock()
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = db.Callback().Query().Remove(cbQ)
		_ = db.Callback().Update().Remove(cbU)
	})

	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}

	idxAkcija, idxSignupUpd, idxPrijava := -1, -1, -1
	for i, e := range events {
		switch e {
		case "lock:akcije":
			if idxAkcija < 0 {
				idxAkcija = i
			}
		case "upd:action_signup_requests":
			if idxSignupUpd < 0 {
				idxSignupUpd = i
			}
		case "lock:prijave":
			if idxPrijava < 0 {
				idxPrijava = i
			}
		}
	}
	if idxAkcija < 0 || idxSignupUpd < 0 || idxPrijava < 0 {
		t.Fatalf("missing events: %v", events)
	}
	if !(idxAkcija < idxSignupUpd && idxSignupUpd < idxPrijava) {
		t.Fatalf("bad order: %v", events)
	}
}

func TestFinishCleanup_ParallelTwoFinish_Once(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_par")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_par", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			a := akcija
			_, errs[idx] = FinishAction(db, &a, actor, FinishActionInput{})
		}(i)
	}
	wg.Wait()

	ok, already := 0, 0
	for _, err := range errs {
		if err == nil {
			ok++
		} else if errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
			already++
		} else {
			t.Fatalf("unexpected: %v", err)
		}
	}
	if ok != 1 || already != 1 {
		t.Fatalf("ok=%d already=%d", ok, already)
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("cancelled once")
	}
}

func TestCancelPendingSignupHelper_RowsAffected(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_help")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_help", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	seedFinishSignup(t, db, akcija.ID, actor.ID, models.ActionSignupRequestAccepted)

	err := db.Transaction(func(tx *gorm.DB) error {
		n, err := helpers.CancelPendingSignupRequestsForActionTx(tx, akcija.ID, time.Now())
		if err != nil {
			return err
		}
		if n != 1 {
			t.Fatalf("rows=%d", n)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
