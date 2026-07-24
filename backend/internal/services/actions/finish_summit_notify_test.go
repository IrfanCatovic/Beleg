package actions

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"gorm.io/gorm"
)

func setSummitRewardNotifyForTest(t *testing.T, fn func(*gorm.DB, uint, models.Akcija)) {
	t.Helper()
	prev := summitRewardNotify
	summitRewardNotify = fn
	t.Cleanup(func() { summitRewardNotify = prev })
}

func countSummitNotifsForUser(t *testing.T, db *gorm.DB, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Obavestenje{}).
		Where("user_id = ? AND type = ?", userID, models.ObavestenjeTipSummitReward).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func seedClubGuideFinish(t *testing.T, db *gorm.DB, suffix string) (guide models.Korisnik, akcija models.Akcija) {
	t.Helper()
	klubID := uint(20 + uint(len(suffix)%40))
	guide = models.Korisnik{Username: "gsum_" + suffix, Password: "x", Role: "vodic", KlubID: &klubID}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	akcija = models.Akcija{
		Naziv: "Summit " + suffix, Datum: time.Now().Add(24 * time.Hour),
		VodicID: guide.ID, AddedByID: guide.ID, KlubID: &klubID, OrganizatorTip: "klub",
		UkupnoKmAkcija: 3, UkupnoMetaraUsponaAkcija: 100, CenaClan: 0,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}
	return guide, akcija
}

func TestFinishAction_GuidePromote_NotifiesOnceAfterCommit(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "ok")

	var notifyCalls int32
	var seenUserID uint
	setSummitRewardNotifyForTest(t, func(gdb *gorm.DB, userID uint, a models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
		seenUserID = userID
		notifications.NotifySummitReward(gdb, userID, a)
	})

	res, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err != nil {
		t.Fatalf("FinishAction: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
	if len(res.SummitRewardNotifications) != 1 || res.SummitRewardNotifications[0].RecipientUserID != guide.ID {
		t.Fatalf("snapshot=%v", res.SummitRewardNotifications)
	}
	if atomic.LoadInt32(&notifyCalls) != 1 || seenUserID != guide.ID {
		t.Fatalf("notifyCalls=%d user=%d", notifyCalls, seenUserID)
	}
	if countSummitNotifsForUser(t, db, guide.ID) != 1 {
		t.Fatal("expected one in-app summit notification")
	}
	var n models.Obavestenje
	if err := db.Where("user_id = ? AND type = ?", guide.ID, models.ObavestenjeTipSummitReward).First(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n.Title != "Čestitamo!" {
		t.Fatalf("title=%q", n.Title)
	}
	if !strings.Contains(n.Body, akcija.Naziv) {
		t.Fatalf("body=%q", n.Body)
	}
	wantLink := fmt.Sprintf("/akcije/%d?claimReward=1", akcija.ID)
	if n.Link != wantLink {
		t.Fatalf("link=%q want %q", n.Link, wantLink)
	}
	if !strings.Contains(n.Metadata, `"akcijaId"`) {
		t.Fatalf("metadata=%q", n.Metadata)
	}
	if reloadUser(t, db, guide.ID).BrojPopeoSe != 1 {
		t.Fatal("stats must be committed")
	}
}

func TestFinishAction_NotifySeesCommittedState(t *testing.T) {
	db := testFinishDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)
	guide, akcija := seedClubGuideFinish(t, db, "commit")

	var sawCompleted bool
	var sawStats bool
	setSummitRewardNotifyForTest(t, func(gdb *gorm.DB, userID uint, a models.Akcija) {
		var locked models.Akcija
		if err := gdb.First(&locked, a.ID).Error; err != nil {
			t.Errorf("notify must see action: %v", err)
			return
		}
		if !locked.IsCompleted {
			t.Error("notify must see completed action")
			return
		}
		sawCompleted = true
		u := models.Korisnik{}
		if err := gdb.First(&u, userID).Error; err != nil {
			t.Errorf("notify must see user: %v", err)
			return
		}
		if u.BrojPopeoSe != 1 {
			t.Errorf("notify must see committed stats, BrojPopeoSe=%d", u.BrojPopeoSe)
			return
		}
		sawStats = true
		notifications.NotifySummitReward(gdb, userID, a)
	})

	if _, err := FinishAction(db, &akcija, guide, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if !sawCompleted || !sawStats {
		t.Fatal("notify did not observe committed domain state")
	}
}

func TestFinishAction_NoGuidePromote_NoNotify(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "nsum_actor")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "nsum_mem", "popeo se", false)

	var notifyCalls int32
	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("completed")
	}
	if len(res.SummitRewardNotifications) != 0 {
		t.Fatalf("snapshot=%v", res.SummitRewardNotifications)
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify without reward domain effect")
	}
}

func TestFinishAction_GuideAlreadyPopeoSe_NoNotify(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "already")
	if err := db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide.ID).
		Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}

	var notifyCalls int32
	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	res, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.SummitRewardNotifications) != 0 || atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("already popeo se → no new reward notify")
	}
}

func TestFinishAction_ParallelFinish_OneNotifyFanOut(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "par")

	var notifyCalls int32
	setSummitRewardNotifyForTest(t, func(gdb *gorm.DB, userID uint, a models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
		notifications.NotifySummitReward(gdb, userID, a)
	})

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			a := akcija
			_, errs[idx] = FinishAction(db, &a, guide, FinishActionInput{})
		}(i)
	}
	wg.Wait()

	ok, conflict := 0, 0
	for _, err := range errs {
		if err == nil {
			ok++
		} else if errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
			conflict++
		} else {
			t.Fatalf("unexpected errs=%v", errs)
		}
	}
	if ok != 1 || conflict != 1 {
		t.Fatalf("expected 1 ok + 1 conflict, errs=%v", errs)
	}
	if atomic.LoadInt32(&notifyCalls) != 1 {
		t.Fatalf("one fan-out, got %d", notifyCalls)
	}
	if countSummitNotifsForUser(t, db, guide.ID) != 1 {
		t.Fatal("one notification row")
	}
}

func TestFinishAction_UnresolvedGuard_NoNotify(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "unres")
	seedFinishPrijava(t, db, akcija.ID, "unres_mem", "prijavljen", false)

	var notifyCalls int32
	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	_, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaHasUnresolvedParticipants) {
		t.Fatalf("err=%v", err)
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify on guard failure")
	}
	var a models.Akcija
	_ = db.First(&a, akcija.ID)
	if a.IsCompleted {
		t.Fatal("must not complete")
	}
}

func TestFinishAction_Cancelled_NoNotify(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "canc")
	if err := db.Model(&akcija).Update("is_cancelled", true).Error; err != nil {
		t.Fatal(err)
	}

	var notifyCalls int32
	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	_, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaCancelled) {
		t.Fatalf("err=%v", err)
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify")
	}
}

func TestFinishAction_FinanceError_RollbackNoNotify(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "finerr")
	// Paid participant with positive saldo → Transakcija create path.
	mem := models.Korisnik{Username: "finerr_m", Password: "x", Role: "clan"}
	if err := db.Create(&mem).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&akcija).Updates(map[string]any{"cena_clan": 100.0}).Error; err != nil {
		t.Fatal(err)
	}
	akcija.CenaClan = 100
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: mem.ID, Status: "popeo se", Platio: true,
	}).Error; err != nil {
		t.Fatal(err)
	}

	var notifyCalls int32
	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	cbName := "fail_finish_tx_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "transakcije" {
			_ = tx.AddError(errors.New("forced finance failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	_, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err == nil {
		t.Fatal("expected finance failure")
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify after rollback")
	}
	var a models.Akcija
	_ = db.First(&a, akcija.ID)
	if a.IsCompleted {
		t.Fatal("must roll back completed")
	}
	if reloadUser(t, db, guide.ID).BrojPopeoSe != 0 {
		t.Fatal("guide stats must roll back")
	}
}

func TestFinishAction_CompletedSaveError_NoNotify(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "saveerr")

	var notifyCalls int32
	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	var saveHits int32
	cbName := "fail_finish_save_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Update().Before("gorm:before_update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" {
			return
		}
		// Fail the IsCompleted save (after guide prijava/user updates).
		if atomic.AddInt32(&saveHits, 1) >= 1 {
			// Skip early updates if any; fail when setting completed.
			if dest, ok := tx.Statement.Dest.(*models.Akcija); ok && dest != nil && dest.IsCompleted {
				_ = tx.AddError(errors.New("forced completed save failure"))
			}
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err == nil {
		t.Fatal("expected save failure")
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify")
	}
}

func TestFinishAction_NotifyFailure_StillSuccess(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "nfail")

	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		panic("forced summit notify failure")
	})

	res, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err != nil {
		t.Fatalf("finish must succeed despite notify panic: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("completed")
	}
	if reloadUser(t, db, guide.ID).BrojPopeoSe != 1 {
		t.Fatal("stats remain")
	}
}

func TestFinishAction_InAppInsertFailure_StillSuccess(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "inapp")

	setSummitRewardNotifyForTest(t, notifications.NotifySummitReward)
	if err := db.Migrator().DropTable(&models.Obavestenje{}); err != nil {
		t.Fatal(err)
	}

	res, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err != nil {
		t.Fatalf("finish must succeed: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("completed")
	}
	if reloadUser(t, db, guide.ID).BrojPopeoSe != 1 {
		t.Fatal("stats remain")
	}
}

func TestFinishAction_NotifyHookRestored(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "hook1")

	var calls int32
	setSummitRewardNotifyForTest(t, func(*gorm.DB, uint, models.Akcija) {
		atomic.AddInt32(&calls, 1)
	})
	if _, err := FinishAction(db, &akcija, guide, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Fatal("override used")
	}
	if countSummitNotifsForUser(t, db, guide.ID) != 0 {
		t.Fatal("override suppressed real notify")
	}
}

func TestFinishAction_NotifyHooksIsolated(t *testing.T) {
	db := testFinishDB(t)
	guide, akcija := seedClubGuideFinish(t, db, "hook2")

	prev := summitRewardNotify
	summitRewardNotify = func(*gorm.DB, uint, models.Akcija) {}
	t.Cleanup(func() { summitRewardNotify = prev })

	if _, err := FinishAction(db, &akcija, guide, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if countSummitNotifsForUser(t, db, guide.ID) != 0 {
		t.Fatal("override suppressed")
	}

	summitRewardNotify = prev
	guide2, akcija2 := seedClubGuideFinish(t, db, "hook2b")
	if _, err := FinishAction(db, &akcija2, guide2, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	if countSummitNotifsForUser(t, db, guide2.ID) != 1 {
		t.Fatal("restored default must notify")
	}
}

func TestFinishAction_UsesUniqueMemoryDSN(t *testing.T) {
	db1 := testFinishDB(t)
	db2 := testFinishDB(t)
	guide, _ := seedClubGuideFinish(t, db1, "dsn")
	var n int64
	if err := db2.Model(&models.Korisnik{}).Where("username = ?", guide.Username).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("sibling DSN isolation")
	}
}
