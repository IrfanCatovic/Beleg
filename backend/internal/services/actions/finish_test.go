package actions

import (
	"errors"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testFinishDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "actions")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionSignupRequest{},
		&models.ActionInviteLink{},
		&models.Transakcija{},
		&models.Obavestenje{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func seedFinishActor(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "admin"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedFinishAkcija(t *testing.T, db *gorm.DB, actor models.Korisnik, opts ...func(*models.Akcija)) models.Akcija {
	t.Helper()
	a := models.Akcija{
		Naziv: "Finish test", Datum: time.Now().Add(48 * time.Hour),
		AddedByID: actor.ID, VodicID: actor.ID, OrganizatorTip: "klub",
		CenaClan: 100, MaxLjudi: 10, IsCompleted: false,
		UkupnoKmAkcija: 5, UkupnoMetaraUsponaAkcija: 200,
	}
	for _, opt := range opts {
		opt(&a)
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func seedFinishPrijava(t *testing.T, db *gorm.DB, akcijaID uint, username, status string, platio bool) models.Prijava {
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

func countTransakcije(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Transakcija{}).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func reloadAkcija(t *testing.T, db *gorm.DB, id uint) models.Akcija {
	t.Helper()
	var a models.Akcija
	if err := db.First(&a, id).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func TestFinishAction_BlocksSinglePrijavljen(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_block1")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "mem_p1", "prijavljen", true)

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaHasUnresolvedParticipants) {
		t.Fatalf("expected ErrAkcijaHasUnresolvedParticipants, got %v", err)
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("IsCompleted must stay false")
	}
	if countTransakcije(t, db) != 0 {
		t.Fatal("must not create Transakcija")
	}
}

func TestFinishAction_BlocksWhenAnyPrijavljenAmongMany(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_block_many")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "m1", "popeo se", true)
	seedFinishPrijava(t, db, akcija.ID, "m2", "prijavljen", false)
	seedFinishPrijava(t, db, akcija.ID, "m3", "nije uspeo", false)

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaHasUnresolvedParticipants) {
		t.Fatalf("expected unresolved, got %v", err)
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("must not complete")
	}
}

func TestFinishAction_AllPopeoSeSucceeds(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_all_popeo")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "p1", "popeo se", true)
	seedFinishPrijava(t, db, akcija.ID, "p2", "popeo se", true)

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestFinishAction_AllNijeUspeoSucceeds(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_all_nu")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "n1", "nije uspeo", false)

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestFinishAction_MixedFinalStatusesSucceeds(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_mixed")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "mx1", "popeo se", true)
	seedFinishPrijava(t, db, akcija.ID, "mx2", "nije uspeo", false)
	seedFinishPrijava(t, db, akcija.ID, "mx3", "otkazano", false)

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestFinishAction_NoPrijaveSucceeds(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_empty")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestFinishAction_GuidePrijavljenAutoPromotes(t *testing.T) {
	db := testFinishDB(t)
	// Club guide (role vodic, same klub) is eligible for peak promotion.
	klubID := uint(7)
	guide := models.Korisnik{Username: "fin_guide", Password: "x", Role: "vodic", KlubID: &klubID}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Guide finish", Datum: time.Now().Add(24 * time.Hour),
		VodicID: guide.ID, AddedByID: guide.ID, KlubID: &klubID, OrganizatorTip: "klub",
		UkupnoKmAkcija: 3, UkupnoMetaraUsponaAkcija: 100,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}
	member := seedFinishPrijava(t, db, akcija.ID, "fin_g_mem", "popeo se", false)

	res, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err != nil {
		t.Fatalf("guide-only unresolved should auto-promote: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
	var guidePrijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide.ID).First(&guidePrijava).Error; err != nil {
		t.Fatal(err)
	}
	if guidePrijava.Status != "popeo se" {
		t.Fatalf("guide should be popeo se, got %s", guidePrijava.Status)
	}
	_ = member
	reloaded := reloadUser(t, db, guide.ID)
	if reloaded.BrojPopeoSe != 1 {
		t.Fatalf("guide stats expected BrojPopeoSe=1, got %d", reloaded.BrojPopeoSe)
	}
}

func TestFinishAction_GuideAndMemberPrijavljenBlocksAndRollsBackGuide(t *testing.T) {
	db := testFinishDB(t)
	klubID := uint(8)
	guide := models.Korisnik{Username: "fin_guide2", Password: "x", Role: "vodic", KlubID: &klubID}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Guide+member", Datum: time.Now().Add(24 * time.Hour),
		VodicID: guide.ID, AddedByID: guide.ID, KlubID: &klubID, OrganizatorTip: "klub",
		UkupnoKmAkcija: 3, UkupnoMetaraUsponaAkcija: 100,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}
	seedFinishPrijava(t, db, akcija.ID, "fin_g_block", "prijavljen", false)

	_, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaHasUnresolvedParticipants) {
		t.Fatalf("expected unresolved, got %v", err)
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("must not complete")
	}
	var guidePrijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide.ID).First(&guidePrijava).Error; err != nil {
		t.Fatal(err)
	}
	if guidePrijava.Status != "prijavljen" {
		t.Fatalf("guide promotion must rollback, got %s", guidePrijava.Status)
	}
	if reloadUser(t, db, guide.ID).BrojPopeoSe != 0 {
		t.Fatal("guide stats must rollback")
	}
	if countTransakcije(t, db) != 0 {
		t.Fatal("no transakcija on failed finish")
	}
}

func TestFinishAction_GuideAlreadyPopeoSe(t *testing.T) {
	db := testFinishDB(t)
	klubID := uint(9)
	guide := models.Korisnik{Username: "fin_guide3", Password: "x", Role: "vodic", KlubID: &klubID}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Guide done", Datum: time.Now().Add(24 * time.Hour),
		VodicID: guide.ID, AddedByID: guide.ID, KlubID: &klubID, OrganizatorTip: "klub",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "popeo se",
	}).Error; err != nil {
		t.Fatal(err)
	}

	res, err := FinishAction(db, &akcija, guide, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestFinishAction_PendingSignupCancelledOnFinish(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_pending")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	reqUser := models.Korisnik{Username: "pending_u", Password: "x", Role: "clan"}
	if err := db.Create(&reqUser).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: reqUser.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
	var req models.ActionSignupRequest
	if err := db.Where("akcija_id = ?", akcija.ID).First(&req).Error; err != nil {
		t.Fatal(err)
	}
	if req.Status != models.ActionSignupRequestCancelled {
		t.Fatalf("pending must become cancelled, got %s", req.Status)
	}
	if req.RespondedAt == nil {
		t.Fatal("RespondedAt must be set")
	}
	if req.ReviewedByID != nil {
		t.Fatal("ReviewedByID must stay nil")
	}
}

func TestFinishAction_AcceptAfterFinishFails(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_acc_after")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0; a.MaxLjudi = 5 })
	requester := models.Korisnik{Username: "acc_after", Password: "x", Role: "clan"}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}

	if _, err := FinishAction(db, &akcija, actor, FinishActionInput{}); err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := helpers.CreateConfirmedPrijavaTx(tx, akcija.ID, requester.ID, time.Now(), helpers.ConfirmedPrijavaPolicyMemberSignup)
		return err
	})
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected ErrAkcijaAlreadyComplete, got %v", err)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, requester.ID).Count(&n)
	if n != 0 {
		t.Fatal("must not create prijava after finish")
	}
}

func TestFinishAction_AlreadyCompletePriority(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_done")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) {
		a.VodicID = 0
		a.IsCompleted = true
	})
	seedFinishPrijava(t, db, akcija.ID, "still_p", "prijavljen", false)

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("AlreadyComplete must take priority, got %v", err)
	}
}

func TestFinishAction_FutureDateAllowed(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_future")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) {
		a.VodicID = 0
		a.Datum = time.Now().Add(30 * 24 * time.Hour)
	})

	res, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("future date must still allow finish")
	}
}

func TestFinishAction_ParallelFinishOneWins(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_par")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })
	seedFinishPrijava(t, db, akcija.ID, "par_paid", "popeo se", true)

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
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if ok != 1 || already != 1 {
		t.Fatalf("expected 1 success + 1 AlreadyComplete, got ok=%d already=%d errs=%v", ok, already, errs)
	}
	if countTransakcije(t, db) != 1 {
		t.Fatalf("expected exactly 1 transakcija, got %d", countTransakcije(t, db))
	}
}

func TestFinishAction_QueryErrorNotTreatedAsEmpty(t *testing.T) {
	db := testFinishDB(t)
	actor := seedFinishActor(t, db, "fin_qerr")
	akcija := seedFinishAkcija(t, db, actor, func(a *models.Akcija) { a.VodicID = 0 })

	cbName := "fail_unresolved_count"
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(gdb *gorm.DB) {
		if gdb.Statement != nil && gdb.Statement.Table == "prijave" {
			// Fail the status=prijavljen count after lock Find may also hit prijave —
			// force error on any prijave query after first lock by checking SQL later.
			_ = gdb.AddError(errors.New("forced prijave query failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer db.Callback().Query().Remove(cbName)

	_, err := FinishAction(db, &akcija, actor, FinishActionInput{})
	if err == nil {
		t.Fatal("expected query failure")
	}
	if reloadAkcija(t, db, akcija.ID).IsCompleted {
		t.Fatal("must not complete on query error")
	}
	if countTransakcije(t, db) != 0 {
		t.Fatal("must not create transakcija on query error")
	}
}
