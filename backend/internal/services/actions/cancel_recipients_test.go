package actions

import (
	"errors"
	"reflect"
	"testing"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func TestMergeCancelRecipientIDs(t *testing.T) {
	got := MergeCancelRecipientIDs(
		[]uint{5, 0, 3, 5, 1},
		[]uint{3, 7, 0, 2},
		1, // actor
	)
	want := []uint{2, 3, 5, 7}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestCollectCancelRecipientIDs_Statuses(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "recv_actor")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	pPrijavljen := seedFinishPrijava(t, db, akcija.ID, "recv_p", "prijavljen", false)
	pPopeo := seedFinishPrijava(t, db, akcija.ID, "recv_popeo", "popeo se", true)
	pNije := seedFinishPrijava(t, db, akcija.ID, "recv_nije", "nije uspeo", false)
	_ = seedFinishPrijava(t, db, akcija.ID, "recv_otk", "otkazano", false)

	pending := models.Korisnik{Username: "recv_pend", Password: "x"}
	if err := db.Create(&pending).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishSignup(t, db, akcija.ID, pending.ID, models.ActionSignupRequestPending)

	rejected := models.Korisnik{Username: "recv_rej", Password: "x"}
	if err := db.Create(&rejected).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishSignup(t, db, akcija.ID, rejected.ID, models.ActionSignupRequestRejected)

	earlierCancelled := models.Korisnik{Username: "recv_canc", Password: "x"}
	if err := db.Create(&earlierCancelled).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishSignup(t, db, akcija.ID, earlierCancelled.ID, models.ActionSignupRequestCancelled)

	// Actor also has a confirmed prijava — must be excluded.
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: actor.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	// Same user as prijava + pending → one entry.
	dup := models.Korisnik{Username: "recv_dup", Password: "x"}
	if err := db.Create(&dup).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: dup.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishSignup(t, db, akcija.ID, dup.ID, models.ActionSignupRequestPending)

	ids, err := CollectCancelRecipientIDs(db, akcija.ID, actor.ID)
	if err != nil {
		t.Fatal(err)
	}

	wantSet := map[uint]struct{}{
		pPrijavljen.KorisnikID: {},
		pPopeo.KorisnikID:      {},
		pNije.KorisnikID:       {},
		pending.ID:             {},
		dup.ID:                 {},
	}
	if len(ids) != len(wantSet) {
		t.Fatalf("len=%d ids=%v want %v", len(ids), ids, wantSet)
	}
	for i := 1; i < len(ids); i++ {
		if ids[i-1] >= ids[i] {
			t.Fatalf("not sorted: %v", ids)
		}
	}
	for _, id := range ids {
		if _, ok := wantSet[id]; !ok {
			t.Fatalf("unexpected recipient %d in %v", id, ids)
		}
		if id == actor.ID {
			t.Fatal("actor must be excluded")
		}
		if id == rejected.ID || id == earlierCancelled.ID {
			t.Fatal("rejected/earlier-cancelled must be excluded")
		}
	}
}

func TestCancelAction_RecipientSnapshotBeforeSignupCleanup(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "snap_actor")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	p := seedFinishPrijava(t, db, akcija.ID, "snap_p", "prijavljen", false)
	u := models.Korisnik{Username: "snap_pend", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	req := seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)

	result, err := CancelAction(db, akcija.ID, "Snapshot razlog", actor.ID, allowCancel)
	if err != nil {
		t.Fatal(err)
	}
	if reloadSignup(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("pending must be cancelled after commit")
	}
	want := []uint{p.KorisnikID, u.ID}
	if len(want) == 2 && want[0] > want[1] {
		want[0], want[1] = want[1], want[0]
	}
	if !reflect.DeepEqual(result.RecipientUserIDs, want) {
		t.Fatalf("recipients=%v want %v", result.RecipientUserIDs, want)
	}
}

func TestCancelAction_RollbackNoRecipientsReturned(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "rb_recv")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "rb_p", "prijavljen", false)
	u := models.Korisnik{Username: "rb_pend", Password: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishSignup(t, db, akcija.ID, u.ID, models.ActionSignupRequestPending)

	result, err := CancelAction(db, akcija.ID, "Validan razlog", actor.ID, func(tx *gorm.DB, locked *models.Akcija) error {
		return ErrCancelUnauthorized
	})
	if !errors.Is(err, ErrCancelUnauthorized) {
		t.Fatalf("err=%v", err)
	}
	if result != nil {
		t.Fatalf("result must be nil on rollback, got %+v", result)
	}
}
