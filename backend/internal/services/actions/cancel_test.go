package actions

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func allowCancel(_ *gorm.DB, _ *models.Akcija) error { return nil }

func TestNormalizeCancelReason(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    string
		wantErr bool
	}{
		{"trim", "  Loši uslovi  ", "Loši uslovi", false},
		{"unicode3", "šćč", "šćč", false},
		{"empty", "", "", true},
		{"spaces", "   ", "", true},
		{"short", "ab", "", true},
		{"unicodeShort", "šč", "", true},
		{"exact500", string(make([]rune, 500)), string(make([]rune, 500)), false},
		{"over500", string(make([]rune, 501)), "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeCancelReason(tt.in)
			if tt.wantErr {
				if !errors.Is(err, ErrCancelReasonInvalid) {
					t.Fatalf("err=%v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want || utf8.RuneCountInString(got) != utf8.RuneCountInString(tt.want) {
				t.Fatalf("got %q want %q", got, tt.want)
			}
		})
	}
}

func TestCancelAction_ActiveEmpty_Success(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_ok")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	result, err := CancelAction(db, akcija.ID, "  Loši uslovi  ", actor.ID, allowCancel)
	if err != nil {
		t.Fatal(err)
	}
	out := result.Akcija
	if !out.IsCancelled || out.IsCompleted {
		t.Fatalf("cancelled=%v completed=%v", out.IsCancelled, out.IsCompleted)
	}
	if out.CancelledAt == nil {
		t.Fatal("CancelledAt required")
	}
	if out.CancellationReason != "Loši uslovi" {
		t.Fatalf("reason=%q", out.CancellationReason)
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if !reloaded.IsCancelled || reloaded.IsCompleted || reloaded.CancellationReason != "Loši uslovi" {
		t.Fatalf("db state: %+v", reloaded)
	}
}

func TestCancelAction_UnicodeReason(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_uni")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	result, err := CancelAction(db, akcija.ID, "žđš", actor.ID, allowCancel)
	if err != nil {
		t.Fatal(err)
	}
	if result.Akcija.CancellationReason != "žđš" {
		t.Fatalf("reason=%q", result.Akcija.CancellationReason)
	}
}

func TestCancelAction_InvalidReasons(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_bad")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	for _, reason := range []string{"", "  ", "ab", "šč", string(make([]rune, 501))} {
		_, err := CancelAction(db, akcija.ID, reason, actor.ID, allowCancel)
		if !errors.Is(err, ErrCancelReasonInvalid) {
			t.Fatalf("reason %q: err=%v", reason, err)
		}
		reloaded := reloadAkcija(t, db, akcija.ID)
		if reloaded.IsCancelled || reloaded.CancelledAt != nil || reloaded.CancellationReason != "" {
			t.Fatalf("action mutated for reason %q: %+v", reason, reloaded)
		}
	}
}

func TestCancelAction_Unauthorized(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_unauth")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_pend", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	inv := seedFinishInvite(t, db, akcija.ID, "hash-unauth", nil, nil)

	_, err := CancelAction(db, akcija.ID, "Validan razlog", actor.ID, func(tx *gorm.DB, locked *models.Akcija) error {
		return ErrCancelUnauthorized
	})
	if !errors.Is(err, ErrCancelUnauthorized) {
		t.Fatalf("err=%v", err)
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if reloaded.IsCancelled {
		t.Fatal("must not cancel")
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("pending untouched")
	}
	if reloadInvite(t, db, inv.ID).RevokedAt != nil {
		t.Fatal("invite untouched")
	}
}

func TestCancelAction_NotFound(t *testing.T) {
	db := testFinishDB(t)
	_, err := CancelAction(db, 999999, "Validan razlog", 0, allowCancel)
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("err=%v", err)
	}
}

func TestCancelAction_Completed(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_done")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) {
		a.VodicID = 0
		a.IsCompleted = true
	})
	u := models.Korisnik{Username: "u_done", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	inv := seedFinishInvite(t, db, akcija.ID, "hash-done", nil, nil)

	_, err := CancelAction(db, akcija.ID, "Validan razlog", actor.ID, allowCancel)
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("err=%v", err)
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if reloaded.IsCancelled || !reloaded.IsCompleted {
		t.Fatalf("state=%+v", reloaded)
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("pending untouched")
	}
	if reloadInvite(t, db, inv.ID).RevokedAt != nil {
		t.Fatal("invite untouched")
	}
}

func TestCancelAction_AlreadyCancelled(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_again")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	result, err := CancelAction(db, akcija.ID, "Prvi razlog ok", actor.ID, allowCancel)
	if err != nil {
		t.Fatal(err)
	}
	first := result.Akcija
	_, err = CancelAction(db, akcija.ID, "Drugi razlog ok", actor.ID, allowCancel)
	if !errors.Is(err, helpers.ErrAkcijaAlreadyCancelled) {
		t.Fatalf("err=%v", err)
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if reloaded.CancellationReason != "Prvi razlog ok" {
		t.Fatalf("reason changed to %q", reloaded.CancellationReason)
	}
	if reloaded.CancelledAt == nil || !reloaded.CancelledAt.Equal(*first.CancelledAt) {
		t.Fatalf("CancelledAt changed: %v vs %v", reloaded.CancelledAt, first.CancelledAt)
	}
}

func TestCancelAction_ContradictoryPrefersAlreadyCancelled(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_contra")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) {
		a.VodicID = 0
		a.IsCompleted = true
		a.IsCancelled = true
		now := time.Now().Add(-time.Hour)
		a.CancelledAt = &now
		a.CancellationReason = "Stari razlog"
	})
	_, err := CancelAction(db, akcija.ID, "Novi razlog xx", actor.ID, allowCancel)
	if !errors.Is(err, helpers.ErrAkcijaAlreadyCancelled) {
		t.Fatalf("err=%v", err)
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if reloaded.CancellationReason != "Stari razlog" {
		t.Fatalf("reason=%q", reloaded.CancellationReason)
	}
}

func TestCancelAction_SignupCleanup(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_su")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	pendingUsers := make([]models.Korisnik, 3)
	pendingIDs := make([]uint, 3)
	for i := 0; i < 3; i++ {
		pendingUsers[i] = models.Korisnik{Username: fmt.Sprintf("pend_%d", i), Password: "x"}
		if err := db.Create(&pendingUsers[i]).Error; err != nil {
			t.Fatal(err)
		}
		pendingIDs[i] = seedFinishSignup(t, db, akcija.ID, pendingUsers[i].ID, models.ActionSignupRequestPending).ID
	}
	termStatuses := []string{
		models.ActionSignupRequestAccepted,
		models.ActionSignupRequestRejected,
		models.ActionSignupRequestCancelled,
	}
	termIDs := make([]uint, len(termStatuses))
	for i, st := range termStatuses {
		u := models.Korisnik{Username: "term_" + st, Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		termIDs[i] = seedFinishSignup(t, db, akcija.ID, u.ID, st).ID
	}

	result, err := CancelAction(db, akcija.ID, "Cleanup razlog", actor.ID, allowCancel)
	if err != nil {
		t.Fatal(err)
	}
	out := result.Akcija
	for _, id := range pendingIDs {
		got := reloadSignup(t, db, id)
		if got.Status != models.ActionSignupRequestCancelled {
			t.Fatalf("pending %d status=%s", id, got.Status)
		}
		if got.RespondedAt == nil || !got.RespondedAt.Equal(*out.CancelledAt) {
			t.Fatalf("RespondedAt mismatch for %d", id)
		}
		if got.ReviewedByID != nil {
			t.Fatalf("ReviewedByID must be nil for %d", id)
		}
	}
	for i, st := range termStatuses {
		if reloadSignup(t, db, termIDs[i]).Status != st {
			t.Fatalf("terminal %s changed", st)
		}
	}
}

func TestCancelAction_ManyPending_SingleBulk(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_500")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	const n = 100
	var updates int32
	cbName := "cancel_bulk_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_signup_requests" {
			atomic.AddInt32(&updates, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	for i := 0; i < n; i++ {
		u := models.Korisnik{Username: fmt.Sprintf("cmany_%d", i), Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	}

	if _, err := CancelAction(db, akcija.ID, "Masovni cleanup", actor.ID, allowCancel); err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt32(&updates) != 1 {
		t.Fatalf("expected 1 bulk signup update, got %d", updates)
	}
	var pending int64
	db.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND status = ?", akcija.ID, models.ActionSignupRequestPending).
		Count(&pending)
	if pending != 0 {
		t.Fatalf("pending left=%d", pending)
	}
}

func TestCancelAction_InviteCleanup(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_inv")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	oldRevoke := time.Now().Add(-48 * time.Hour)
	active := seedFinishInvite(t, db, akcija.ID, "c-hash-1", nil, nil)
	active2 := seedFinishInvite(t, db, akcija.ID, "c-hash-2", nil, nil)
	already := seedFinishInvite(t, db, akcija.ID, "c-hash-rev", &oldRevoke, nil)
	expired := time.Now().Add(-time.Hour)
	expiredActive := seedFinishInvite(t, db, akcija.ID, "c-hash-exp", nil, &expired)

	var inviteUpdates int32
	cbName := "cancel_inv_bulk_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_invite_links" {
			atomic.AddInt32(&inviteUpdates, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	result, err := CancelAction(db, akcija.ID, "Invite cleanup", actor.ID, allowCancel)
	if err != nil {
		t.Fatal(err)
	}
	out := result.Akcija
	if atomic.LoadInt32(&inviteUpdates) != 1 {
		t.Fatalf("expected 1 invite bulk update, got %d", inviteUpdates)
	}
	for _, id := range []uint{active.ID, active2.ID, expiredActive.ID} {
		got := reloadInvite(t, db, id)
		if got.RevokedAt == nil || !got.RevokedAt.Equal(*out.CancelledAt) {
			t.Fatalf("link %d revokedAt=%v want %v", id, got.RevokedAt, out.CancelledAt)
		}
	}
	gotAlready := reloadInvite(t, db, already.ID)
	if gotAlready.RevokedAt == nil || !gotAlready.RevokedAt.Equal(oldRevoke) {
		t.Fatalf("already-revoked changed: %v", gotAlready.RevokedAt)
	}
}

func TestCancelAction_PrijaveAndFinanceUntouched(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_fin")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	statuses := []string{"prijavljen", "popeo se", "nije uspeo", "otkazano"}
	prijavaIDs := make([]uint, len(statuses))
	userStats := make([]models.Korisnik, len(statuses))
	for i, st := range statuses {
		p := seedFinishPrijava(t, db, akcija.ID, "p_"+st, st, st == "prijavljen" || st == "popeo se")
		prijavaIDs[i] = p.ID
		var u models.Korisnik
		if err := db.First(&u, p.KorisnikID).Error; err != nil {
			t.Fatal(err)
		}
		u.BrojPopeoSe = 3
		u.UkupnoKmKorisnik = 12
		if err := db.Save(&u).Error; err != nil {
			t.Fatal(err)
		}
		userStats[i] = u
	}
	if err := db.Create(&models.Transakcija{
		Tip: "uplata", Iznos: 50, Opis: "ručna", Datum: time.Now(), KorisnikID: actor.ID,
	}).Error; err != nil {
		t.Fatal(err)
	}
	beforeTx := countTransakcije(t, db)

	if _, err := CancelAction(db, akcija.ID, "Bez diranja prijava", actor.ID, allowCancel); err != nil {
		t.Fatal(err)
	}

	for i, st := range statuses {
		var p models.Prijava
		if err := db.First(&p, prijavaIDs[i]).Error; err != nil {
			t.Fatal(err)
		}
		if p.Status != st {
			t.Fatalf("status %s -> %s", st, p.Status)
		}
		if st == "prijavljen" || st == "popeo se" {
			if !p.Platio {
				t.Fatalf("Platio cleared for %s", st)
			}
		}
		var u models.Korisnik
		if err := db.First(&u, p.KorisnikID).Error; err != nil {
			t.Fatal(err)
		}
		if u.BrojPopeoSe != userStats[i].BrojPopeoSe || u.UkupnoKmKorisnik != userStats[i].UkupnoKmKorisnik {
			t.Fatalf("stats changed for %s", st)
		}
	}
	if countTransakcije(t, db) != beforeTx {
		t.Fatal("Transakcija count changed")
	}
}

func TestCancelAction_SignupCleanupError_Rollback(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_rb_s")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_crb_s", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	inv := seedFinishInvite(t, db, akcija.ID, "hash-crb-s", nil, nil)

	cbName := "fail_cancel_signup_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_signup_requests" {
			_ = tx.AddError(errors.New("forced signup cleanup failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := CancelAction(db, akcija.ID, "Rollback signup", actor.ID, allowCancel)
	if err == nil {
		t.Fatal("expected failure")
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if reloaded.IsCancelled || reloaded.CancelledAt != nil || reloaded.CancellationReason != "" {
		t.Fatalf("partial cancel: %+v", reloaded)
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("pending")
	}
	if reloadInvite(t, db, inv.ID).RevokedAt != nil {
		t.Fatal("invite")
	}
}

func TestCancelAction_InviteRevokeError_Rollback(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_rb_i")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_crb_i", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	_ = seedFinishInvite(t, db, akcija.ID, "hash-crb-i", nil, nil)

	cbName := "fail_cancel_invite_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_invite_links" {
			_ = tx.AddError(errors.New("forced invite revoke failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := CancelAction(db, akcija.ID, "Rollback invite", actor.ID, allowCancel)
	if err == nil {
		t.Fatal("expected failure")
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if reloaded.IsCancelled {
		t.Fatal("must rollback cancel")
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("signup must rollback")
	}
}

func TestCancelAction_ActionUpdateError_Rollback(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_rb_a")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "u_crb_a", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)
	inv := seedFinishInvite(t, db, akcija.ID, "hash-crb-a", nil, nil)

	cbName := "fail_cancel_akcija_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "akcije" {
			_ = tx.AddError(errors.New("forced action update failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := CancelAction(db, akcija.ID, "Rollback action", actor.ID, allowCancel)
	if err == nil {
		t.Fatal("expected failure")
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if reloaded.IsCancelled {
		t.Fatal("must not cancel")
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("signup rollback")
	}
	if reloadInvite(t, db, inv.ID).RevokedAt != nil {
		t.Fatal("invite rollback")
	}
}

func TestCancelAction_ParallelCancels(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_par")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		results []error
	)
	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func() {
			defer wg.Done()
			_, err := CancelAction(db, akcija.ID, "Paralelni cancel", actor.ID, allowCancel)
			mu.Lock()
			results = append(results, err)
			mu.Unlock()
		}()
	}
	wg.Wait()

	var oks, already int
	for _, err := range results {
		if err == nil {
			oks++
		} else if errors.Is(err, helpers.ErrAkcijaAlreadyCancelled) {
			already++
		} else {
			t.Fatalf("unexpected err %v", err)
		}
	}
	if oks != 1 || already != 1 {
		t.Fatalf("oks=%d already=%d results=%v", oks, already, results)
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if !reloaded.IsCancelled || reloaded.CancellationReason != "Paralelni cancel" {
		t.Fatalf("state=%+v", reloaded)
	}
}

func TestCancelAction_ThenFinishConflict(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "cancel_then_fin")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	if _, err := CancelAction(db, akcija.ID, "Prvo cancel", actor.ID, allowCancel); err != nil {
		t.Fatal(err)
	}
	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("err=%v", err)
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("must not complete")
	}
}

func TestFinishAction_ThenCancelConflict(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_then_cancel")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	_, err := CancelAction(db, akcija.ID, "Posle finish", actor.ID, allowCancel)
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("err=%v", err)
	}
	reloaded := reloadAkcija(t, db, akcija.ID)
	if !reloaded.IsCompleted || reloaded.IsCancelled {
		t.Fatalf("state=%+v", reloaded)
	}
}

func TestCancelAction_AcceptThenCancel_KeepsAccepted(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "acc_then_c")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "acc_user", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)

	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := helpers.LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		_, err = helpers.CreateConfirmedPrijavaTx(tx, locked.ID, u.ID, time.Now(), helpers.ConfirmedPrijavaPolicyMemberSignup)
		if err != nil {
			return err
		}
		now := time.Now()
		return tx.Model(&models.ActionSignupRequest{}).Where("id = ?", req.ID).Updates(map[string]any{
			"status":       models.ActionSignupRequestAccepted,
			"responded_at": now,
		}).Error
	})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := CancelAction(db, akcija.ID, "Posle accept", actor.ID, allowCancel); err != nil {
		t.Fatal(err)
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestAccepted {
		t.Fatal("accepted must stay")
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, u.ID).Count(&n)
	if n != 1 {
		t.Fatal("prijava must remain")
	}
}

func TestCancelAction_CancelThenAccept_NoPrijava(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "c_then_acc")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	u := models.Korisnik{Username: "cacc_user", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)

	if _, err := CancelAction(db, akcija.ID, "Prije accept", actor.ID, allowCancel); err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := helpers.LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		_, err = helpers.CreateConfirmedPrijavaTx(tx, locked.ID, u.ID, time.Now(), helpers.ConfirmedPrijavaPolicyMemberSignup)
		return err
	})
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("err=%v", err)
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("request should be cancelled")
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ?", akcija.ID).Count(&n)
	if n != 0 {
		t.Fatal("no prijava after cancel-first")
	}
}
