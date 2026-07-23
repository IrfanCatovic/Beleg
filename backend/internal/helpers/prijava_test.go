package helpers

import (
	"errors"
	"strconv"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPrijavaDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "helpers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionSignupRequest{},
		&models.Korisnik{},
		&models.AkcijaSmestaj{},
		&models.AkcijaPrevoz{},
		&models.AkcijaOpremaRent{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("create prijava indexes: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db handle: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func TestValidateAkcijaSignupOpen_PastDatumBelgrade(t *testing.T) {
	loc, _ := time.LoadLocation("Europe/Belgrade")
	yesterday := time.Now().In(loc).AddDate(0, 0, -1)
	akcija := &models.Akcija{
		Datum: time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, time.UTC),
	}
	err := ValidateAkcijaSignupOpen(akcija, time.Now())
	if !errors.Is(err, ErrSignupClosed) {
		t.Fatalf("expected ErrSignupClosed, got %v", err)
	}
}

func TestValidateAkcijaSignupOpen_AfterStartAt(t *testing.T) {
	past := time.Now().Add(-2 * time.Hour)
	akcija := &models.Akcija{
		Datum:   time.Now().Add(24 * time.Hour),
		StartAt: &past,
	}
	err := ValidateAkcijaSignupOpen(akcija, time.Now())
	if !errors.Is(err, ErrSignupClosed) {
		t.Fatalf("expected ErrSignupClosed, got %v", err)
	}
}

func TestValidateAkcijaSignupOpen_Completed(t *testing.T) {
	akcija := &models.Akcija{IsCompleted: true, Datum: time.Now().Add(24 * time.Hour)}
	err := ValidateAkcijaSignupOpen(akcija, time.Now())
	if !errors.Is(err, ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected ErrAkcijaAlreadyComplete, got %v", err)
	}
}

func TestValidateAkcijaActive_Cancelled(t *testing.T) {
	akcija := &models.Akcija{IsCancelled: true, Datum: time.Now().Add(24 * time.Hour)}
	if err := ValidateAkcijaActive(akcija); !errors.Is(err, ErrAkcijaCancelled) {
		t.Fatalf("expected ErrAkcijaCancelled, got %v", err)
	}
	if !IsAkcijaTerminal(akcija) {
		t.Fatal("cancelled must be terminal")
	}
}

func TestValidateAkcijaActive_Active(t *testing.T) {
	akcija := &models.Akcija{Datum: time.Now().Add(24 * time.Hour)}
	if err := ValidateAkcijaActive(akcija); err != nil {
		t.Fatalf("active must pass: %v", err)
	}
	if IsAkcijaTerminal(akcija) {
		t.Fatal("active must not be terminal")
	}
}

func TestValidateAkcijaActive_CompletedAndCancelledPrefersCancelled(t *testing.T) {
	akcija := &models.Akcija{IsCompleted: true, IsCancelled: true, Datum: time.Now().Add(24 * time.Hour)}
	if err := ValidateAkcijaActive(akcija); !errors.Is(err, ErrAkcijaCancelled) {
		t.Fatalf("expected ErrAkcijaCancelled for contradictory state, got %v", err)
	}
	if !IsAkcijaTerminal(akcija) {
		t.Fatal("contradictory state must be terminal")
	}
}

func TestValidateAkcijaActive_Completed(t *testing.T) {
	akcija := &models.Akcija{IsCompleted: true, Datum: time.Now().Add(24 * time.Hour)}
	if err := ValidateAkcijaActive(akcija); !errors.Is(err, ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected ErrAkcijaAlreadyComplete, got %v", err)
	}
	if !IsAkcijaTerminal(akcija) {
		t.Fatal("completed must be terminal")
	}
}

func TestValidateAkcijaSignupOpen_Cancelled(t *testing.T) {
	akcija := &models.Akcija{IsCancelled: true, Datum: time.Now().Add(24 * time.Hour)}
	err := ValidateAkcijaSignupOpen(akcija, time.Now())
	if !errors.Is(err, ErrAkcijaCancelled) {
		t.Fatalf("expected ErrAkcijaCancelled, got %v", err)
	}
}

func TestValidateAkcijaSignupDeadline_DoesNotCheckCompleted(t *testing.T) {
	// Deadline helper ne smije blokirati zbog IsCompleted — to je lifecycle.
	akcija := &models.Akcija{IsCompleted: true, Datum: time.Now().Add(24 * time.Hour)}
	if err := ValidateAkcijaSignupDeadline(akcija, time.Now()); err != nil {
		t.Fatalf("deadline check should ignore IsCompleted, got %v", err)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoSkipsDeadlineMemberDoesNot(t *testing.T) {
	db := testPrijavaDB(t)
	pastStart := time.Now().Add(-3 * time.Hour)
	akcija := models.Akcija{
		Naziv: "PastStart", Datum: time.Now().Add(48 * time.Hour),
		StartAt: &pastStart, MaxLjudi: 5,
	}
	guide := models.Korisnik{Username: "g", Password: "x"}
	member := models.Korisnik{Username: "m", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		return err
	}); err != nil {
		t.Fatalf("guide-auto should allow after deadline: %v", err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, member.ID, time.Now(), ConfirmedPrijavaPolicyMemberSignup)
		return err
	})
	if !errors.Is(err, ErrSignupClosed) {
		t.Fatalf("member-signup should block after deadline, got %v", err)
	}
}

func TestCreateConfirmedPrijavaTx_CompletedBlocksNewAllowsExisting(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(48 * time.Hour),
		MaxLjudi: 5, IsCompleted: true,
	}
	existingUser := models.Korisnik{Username: "ex", Password: "x"}
	newUser := models.Korisnik{Username: "nw", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&existingUser).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&newUser).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: existingUser.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		p, err := CreateConfirmedPrijavaTx(tx, akcija.ID, existingUser.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		if err != nil {
			return err
		}
		if p.KorisnikID != existingUser.ID {
			t.Fatalf("unexpected prijava: %+v", p)
		}
		return nil
	}); err != nil {
		t.Fatalf("existing on completed should be idempotent: %v", err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, newUser.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		return err
	})
	if !errors.Is(err, ErrAkcijaAlreadyComplete) {
		t.Fatalf("new prijava on completed should fail, got %v", err)
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, newUser.ID, time.Now(), ConfirmedPrijavaPolicyMemberSignup)
		return err
	})
	if !errors.Is(err, ErrAkcijaAlreadyComplete) {
		t.Fatalf("member signup on completed should fail, got %v", err)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoRespectsCapacity(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Full", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 1}
	filler := models.Korisnik{Username: "fill", Password: "x"}
	guide := models.Korisnik{Username: "g2", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&filler).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: filler.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		return err
	})
	if !errors.Is(err, ErrAkcijaCapacityFull) {
		t.Fatalf("guide-auto must respect capacity, got %v", err)
	}
}

func TestValidateMaxLjudiNotBelowActive(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Test", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 10}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 3; i++ {
		if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: uint(i), Status: "prijavljen"}).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := ValidateMaxLjudiNotBelowActive(db, akcija.ID, 2); !errors.Is(err, ErrMaxLjudiBelowActive) {
		t.Fatalf("expected ErrMaxLjudiBelowActive, got %v", err)
	}
	if err := ValidateMaxLjudiNotBelowActive(db, akcija.ID, 3); err != nil {
		t.Fatalf("expected ok at equal capacity, got %v", err)
	}
}

func TestDuplicatePrijavaUniqueConstraint(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Dup", Datum: time.Now().Add(48 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	p1 := models.Prijava{AkcijaID: akcija.ID, KorisnikID: 1, Status: "prijavljen"}
	if err := db.Create(&p1).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: 1, Status: "prijavljen"}).Error
	if err == nil {
		t.Fatal("expected duplicate error")
	}
	if mapped := MapCreatePrijavaError(err); !errors.Is(mapped, ErrDuplicatePrijava) {
		t.Fatalf("expected ErrDuplicatePrijava, got %v", mapped)
	}
}

func TestEnsureCapacityAvailable_CountsActiveStatuses(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Cap", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 2}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	statuses := []string{"prijavljen", "popeo se"}
	for i, st := range statuses {
		if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: uint(i + 1), Status: st}).Error; err != nil {
			t.Fatal(err)
		}
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureCapacityAvailable(tx, akcija.ID, akcija.MaxLjudi)
	})
	if !errors.Is(err, ErrAkcijaCapacityFull) {
		t.Fatalf("expected full capacity, got %v", err)
	}
}

func TestEnsureCapacityAvailable_ConcurrentAcceptsRespectMax(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Race", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 1}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	userA, userB := models.Korisnik{Username: "a", Password: "x"}, models.Korisnik{Username: "b", Password: "x"}
	if err := db.Create(&userA).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&userB).Error; err != nil {
		t.Fatal(err)
	}

	tryCreate := func(userID uint) error {
		return db.Transaction(func(tx *gorm.DB) error {
			if _, err := LockAkcijaForUpdate(tx, akcija.ID); err != nil {
				return err
			}
			if err := EnsureCapacityAvailable(tx, akcija.ID, akcija.MaxLjudi); err != nil {
				return err
			}
			has, err := HasPrijavaForUser(tx, akcija.ID, userID)
			if err != nil || has {
				return ErrDuplicatePrijava
			}
			return MapCreatePrijavaError(tx.Create(&models.Prijava{
				AkcijaID: akcija.ID, KorisnikID: userID, Status: "prijavljen",
			}).Error)
		})
	}

	if err := tryCreate(userA.ID); err != nil {
		t.Fatalf("first insert: %v", err)
	}
	if err := tryCreate(userB.ID); !errors.Is(err, ErrAkcijaCapacityFull) {
		t.Fatalf("second insert should be capacity full, got %v", err)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ?", akcija.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected 1 prijava, got %d", n)
	}
}

func TestHasPendingSignupRequest_PartialUnique(t *testing.T) {
	db := testPrijavaDB(t)
	akcijaID := uint(1)
	requesterID := uint(5)
	req := models.ActionSignupRequest{
		AkcijaID: akcijaID, RequesterID: requesterID, Status: models.ActionSignupRequestPending,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}
	has, err := HasPendingSignupRequest(db, akcijaID, requesterID)
	if err != nil || !has {
		t.Fatalf("expected pending signup")
	}
	err = db.Create(&models.ActionSignupRequest{
		AkcijaID: akcijaID, RequesterID: requesterID, Status: models.ActionSignupRequestPending,
	}).Error
	if err == nil {
		t.Fatal("expected duplicate pending signup error")
	}
	if mapped := MapCreateSignupRequestError(err); !errors.Is(mapped, ErrPendingSignupExists) {
		t.Fatalf("expected ErrPendingSignupExists, got %v", MapCreateSignupRequestError(err))
	}
}

func TestCreateConfirmedPrijavaTx_IdempotentAndConcurrent(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Tx", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 5}
	user := models.Korisnik{Username: "u1", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	var first models.Prijava
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		first, err = CreateConfirmedPrijavaTx(tx, akcija.ID, user.ID, time.Now(), ConfirmedPrijavaPolicyMemberSignup)
		return err
	}); err != nil {
		t.Fatalf("first create: %v", err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		second, err := CreateConfirmedPrijavaTx(tx, akcija.ID, user.ID, time.Now(), ConfirmedPrijavaPolicyMemberSignup)
		if err != nil {
			return err
		}
		if second.ID != first.ID {
			t.Fatalf("expected same prijava id, got %d vs %d", second.ID, first.ID)
		}
		return nil
	}); err != nil {
		t.Fatalf("idempotent retry: %v", err)
	}

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			errs[idx] = db.Transaction(func(tx *gorm.DB) error {
				_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, user.ID, time.Now(), ConfirmedPrijavaPolicyMemberSignup)
				return err
			})
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatalf("concurrent idempotent call failed: %v", err)
		}
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, user.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected exactly one prijava after concurrent calls, got %d", n)
	}
}

func TestHasBlockingPrijavaForUser_ExcludesOtkazano(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Block", Datum: time.Now().Add(48 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	userID := uint(42)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: userID, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}
	has, err := HasBlockingPrijavaForUser(db, akcija.ID, userID)
	if err != nil || has {
		t.Fatalf("otkazano must not block signup, has=%v err=%v", has, err)
	}
	hasAll, err := HasPrijavaForUser(db, akcija.ID, userID)
	if err != nil || !hasAll {
		t.Fatalf("HasPrijavaForUser should still see otkazano row")
	}
}

func TestHasBlockingPrijavaForUser_BlocksActiveStatuses(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Active", Datum: time.Now().Add(48 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	for i, st := range PrijavaBlockingStatuses {
		userID := uint(i + 1)
		if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: userID, Status: st}).Error; err != nil {
			t.Fatal(err)
		}
		has, err := HasBlockingPrijavaForUser(db, akcija.ID, userID)
		if err != nil || !has {
			t.Fatalf("status %s should block, has=%v err=%v", st, has, err)
		}
	}
}

func TestReactivateCancelledPrijavaFromChoicesTx_UpdatesStatusAndChoices(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "React", Datum: time.Now().Add(48 * time.Hour)}
	user := models.Korisnik{Username: "react_u", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "otkazano", Platio: true}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: "[1]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}

	var out models.Prijava
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		out, err = ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
			SelectedSmestajIDs: "[2]", SelectedPrevozIDs: "[3]", SelectedRentItemsRaw: "[]",
		})
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if out.ID != p.ID || out.Status != "prijavljen" {
		t.Fatalf("unexpected prijava: %+v", out)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !reloaded.Platio {
		t.Fatal("Platio must be preserved")
	}
	var izbor models.PrijavaIzbori
	if err := db.Where("prijava_id = ?", p.ID).First(&izbor).Error; err != nil {
		t.Fatal(err)
	}
	if izbor.SelectedSmestajIDs != "[2]" || izbor.SelectedPrevozIDs != "[3]" {
		t.Fatalf("choices not updated: %+v", izbor)
	}
}

func reactivatePlatioSeed(t *testing.T, db *gorm.DB, cenaClan float64) (models.Akcija, models.Korisnik) {
	t.Helper()
	akcija := models.Akcija{Naziv: "Platio", Datum: time.Now().Add(48 * time.Hour), CenaClan: cenaClan, Javna: true}
	user := models.Korisnik{Username: "platio_u_" + strconv.FormatInt(time.Now().UnixNano(), 10), Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	return akcija, user
}

func reactivatePlatioSmestaj(t *testing.T, db *gorm.DB, akcijaID uint, naziv string, cena float64) models.AkcijaSmestaj {
	t.Helper()
	s := models.AkcijaSmestaj{AkcijaID: akcijaID, Naziv: naziv, CenaPoOsobiUkupno: cena}
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	return s
}

func runReactivatePlatioTest(
	t *testing.T,
	initialPlatio bool,
	oldSmestajJSON string,
	newPayload PrijavaIzboriPayload,
	wantPlatio bool,
) models.Prijava {
	t.Helper()
	db := testPrijavaDB(t)
	akcija, user := reactivatePlatioSeed(t, db, 0)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "otkazano", Platio: initialPlatio}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if oldSmestajJSON != "" {
		if err := db.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: oldSmestajJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, newPayload)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.Platio != wantPlatio {
		t.Fatalf("Platio: got %v want %v", reloaded.Platio, wantPlatio)
	}
	if reloaded.Status != "prijavljen" {
		t.Fatalf("status: got %s", reloaded.Status)
	}
	return reloaded
}

func TestReactivateCancelledPrijavaFromChoicesTx_PlatioSaldoRules(t *testing.T) {
	db := testPrijavaDB(t)
	akcija, user := reactivatePlatioSeed(t, db, 0)
	cheap := reactivatePlatioSmestaj(t, db, akcija.ID, "Cheap", 30)
	expensive := reactivatePlatioSmestaj(t, db, akcija.ID, "Expensive", 70)
	equalA := reactivatePlatioSmestaj(t, db, akcija.ID, "EqA", 50)
	equalB := reactivatePlatioSmestaj(t, db, akcija.ID, "EqB", 50)

	cheapJSON := "[" + strconv.FormatUint(uint64(cheap.ID), 10) + "]"
	expensiveJSON := "[" + strconv.FormatUint(uint64(expensive.ID), 10) + "]"
	equalAJSON := "[" + strconv.FormatUint(uint64(equalA.ID), 10) + "]"
	equalBJSON := "[" + strconv.FormatUint(uint64(equalB.ID), 10) + "]"

	t.Run("expensive rejoin resets Platio", func(t *testing.T) {
		p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "otkazano", Platio: true}
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: cheapJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: expensiveJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var reloaded models.Prijava
		if err := db.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Platio {
			t.Fatal("expected Platio=false when saldo increased")
		}
	})

	t.Run("cheaper rejoin resets Platio", func(t *testing.T) {
		p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID + 1, Status: "otkazano", Platio: true}
		user2 := models.Korisnik{Username: "cheaper_u", Password: "x"}
		if err := db.Create(&user2).Error; err != nil {
			t.Fatal(err)
		}
		p.KorisnikID = user2.ID
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: expensiveJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: cheapJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var reloaded models.Prijava
		if err := db.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Platio {
			t.Fatal("expected Platio=false when saldo decreased")
		}
	})

	t.Run("same choices preserve Platio", func(t *testing.T) {
		user3 := models.Korisnik{Username: "same_u", Password: "x"}
		if err := db.Create(&user3).Error; err != nil {
			t.Fatal(err)
		}
		p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user3.ID, Status: "otkazano", Platio: true}
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: cheapJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: cheapJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var reloaded models.Prijava
		if err := db.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if !reloaded.Platio {
			t.Fatal("expected Platio=true when saldo unchanged")
		}
	})

	t.Run("different choices same saldo preserve Platio", func(t *testing.T) {
		user4 := models.Korisnik{Username: "eq_u", Password: "x"}
		if err := db.Create(&user4).Error; err != nil {
			t.Fatal(err)
		}
		p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user4.ID, Status: "otkazano", Platio: true}
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: equalAJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: equalBJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var reloaded models.Prijava
		if err := db.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if !reloaded.Platio {
			t.Fatal("expected Platio=true when saldo equal despite different option")
		}
	})

	t.Run("Platio false stays false when saldo changes", func(t *testing.T) {
		user5 := models.Korisnik{Username: "false_u", Password: "x"}
		if err := db.Create(&user5).Error; err != nil {
			t.Fatal(err)
		}
		p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user5.ID, Status: "otkazano", Platio: false}
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: cheapJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: expensiveJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var reloaded models.Prijava
		if err := db.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Platio {
			t.Fatal("expected Platio=false")
		}
	})

	t.Run("zero to zero preserves Platio", func(t *testing.T) {
		runReactivatePlatioTest(t, true, "[]", PrijavaIzboriPayload{
			SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}, true)
	})

	t.Run("zero to positive resets Platio", func(t *testing.T) {
		db2 := testPrijavaDB(t)
		akcija2, user6 := reactivatePlatioSeed(t, db2, 0)
		s := reactivatePlatioSmestaj(t, db2, akcija2.ID, "Paid", 30)
		sJSON := "[" + strconv.FormatUint(uint64(s.ID), 10) + "]"
		p := models.Prijava{AkcijaID: akcija2.ID, KorisnikID: user6.ID, Status: "otkazano", Platio: true}
		if err := db2.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db2.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db2.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: sJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var reloaded models.Prijava
		if err := db2.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Platio {
			t.Fatal("expected Platio=false for 0→positive")
		}
	})

	t.Run("positive to zero resets Platio", func(t *testing.T) {
		db3 := testPrijavaDB(t)
		akcija3, user7 := reactivatePlatioSeed(t, db3, 0)
		s := reactivatePlatioSmestaj(t, db3, akcija3.ID, "WasPaid", 30)
		sJSON := "[" + strconv.FormatUint(uint64(s.ID), 10) + "]"
		p := models.Prijava{AkcijaID: akcija3.ID, KorisnikID: user7.ID, Status: "otkazano", Platio: true}
		if err := db3.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db3.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: sJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db3.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var reloaded models.Prijava
		if err := db3.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Platio {
			t.Fatal("expected Platio=false for positive→0")
		}
	})

	t.Run("missing old izbori treated as empty", func(t *testing.T) {
		db4 := testPrijavaDB(t)
		akcija4, user8 := reactivatePlatioSeed(t, db4, 0)
		s := reactivatePlatioSmestaj(t, db4, akcija4.ID, "New", 20)
		sJSON := "[" + strconv.FormatUint(uint64(s.ID), 10) + "]"
		p := models.Prijava{AkcijaID: akcija4.ID, KorisnikID: user8.ID, Status: "otkazano", Platio: true}
		if err := db4.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db4.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: sJSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		}); err != nil {
			t.Fatal(err)
		}
		var izborCount int64
		db4.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", p.ID).Count(&izborCount)
		if izborCount != 1 {
			t.Fatalf("expected 1 izbori row, got %d", izborCount)
		}
		var reloaded models.Prijava
		if err := db4.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Platio {
			t.Fatal("expected Platio=false when old empty and new positive saldo")
		}
	})

	t.Run("invalid new choices JSON rolls back", func(t *testing.T) {
		db5 := testPrijavaDB(t)
		akcija5, user9 := reactivatePlatioSeed(t, db5, 0)
		p := models.Prijava{AkcijaID: akcija5.ID, KorisnikID: user9.ID, Status: "otkazano", Platio: true}
		if err := db5.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db5.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		err := db5.Transaction(func(tx *gorm.DB) error {
			_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{
				SelectedSmestajIDs: "{bad", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
			})
			return err
		})
		if err == nil {
			t.Fatal("expected JSON parse error")
		}
		var reloaded models.Prijava
		if err := db5.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Status != "otkazano" || !reloaded.Platio {
			t.Fatalf("rollback failed: status=%s platio=%v", reloaded.Status, reloaded.Platio)
		}
	})

	t.Run("concurrent accept single Platio decision", func(t *testing.T) {
		db6 := testPrijavaDB(t)
		akcija6, user10 := reactivatePlatioSeed(t, db6, 0)
		cheap6 := reactivatePlatioSmestaj(t, db6, akcija6.ID, "C", 30)
		expensive6 := reactivatePlatioSmestaj(t, db6, akcija6.ID, "E", 70)
		cheap6JSON := "[" + strconv.FormatUint(uint64(cheap6.ID), 10) + "]"
		expensive6JSON := "[" + strconv.FormatUint(uint64(expensive6.ID), 10) + "]"
		p := models.Prijava{AkcijaID: akcija6.ID, KorisnikID: user10.ID, Status: "otkazano", Platio: true}
		if err := db6.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if err := db6.Create(&models.PrijavaIzbori{
			PrijavaID: p.ID, SelectedSmestajIDs: cheap6JSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}).Error; err != nil {
			t.Fatal(err)
		}
		payload := PrijavaIzboriPayload{
			SelectedSmestajIDs: expensive6JSON, SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}
		var wg sync.WaitGroup
		errs := make([]error, 2)
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				errs[idx] = db6.Transaction(func(tx *gorm.DB) error {
					_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, payload)
					return err
				})
			}(i)
		}
		wg.Wait()
		success := 0
		for _, err := range errs {
			if err == nil {
				success++
			} else if !errors.Is(err, ErrDuplicatePrijava) {
				t.Fatalf("unexpected error: %v", err)
			}
		}
		if success != 1 {
			t.Fatalf("expected one success, got %d errs=%v", success, errs)
		}
		var reloaded models.Prijava
		if err := db6.First(&reloaded, p.ID).Error; err != nil {
			t.Fatal(err)
		}
		if reloaded.Platio {
			t.Fatal("expected Platio=false after expensive rejoin")
		}
		var izborCount int64
		db6.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", p.ID).Count(&izborCount)
		if izborCount != 1 {
			t.Fatalf("expected 1 izbori, got %d", izborCount)
		}
	})
}

func TestReactivateCancelledPrijavaFromChoicesTx_RejectsNonOtkazano(t *testing.T) {
	db := testPrijavaDB(t)
	p := models.Prijava{AkcijaID: 1, KorisnikID: 1, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := ReactivateCancelledPrijavaFromChoicesTx(tx, p.ID, PrijavaIzboriPayload{})
		return err
	})
	if !errors.Is(err, ErrDuplicatePrijava) {
		t.Fatalf("expected ErrDuplicatePrijava, got %v", err)
	}
}

func TestCreateConfirmedPrijavaTx_MemberSignupDoesNotReactivateOtkazano(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Mem", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 5}
	user := models.Korisnik{Username: "mem", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "otkazano", Platio: true}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	var out models.Prijava
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		out, err = CreateConfirmedPrijavaTx(tx, akcija.ID, user.ID, time.Now(), ConfirmedPrijavaPolicyMemberSignup)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if out.ID != p.ID || out.Status != "otkazano" {
		t.Fatalf("member signup must not reactivate otkazano, got %+v", out)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoReactivatesOtkazano(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Guide", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 5}
	guide := models.Korisnik{Username: "g", Password: "x", Role: "vodic"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "otkazano", Platio: true}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: "[7]", SelectedPrevozIDs: "[3]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}

	var out models.Prijava
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		out, err = CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if out.ID != p.ID || out.Status != "prijavljen" {
		t.Fatalf("expected reactivated prijava, got %+v", out)
	}
	var reloaded models.Prijava
	if err := db.First(&reloaded, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !reloaded.Platio {
		t.Fatal("Platio must be preserved")
	}
	var izbor models.PrijavaIzbori
	if err := db.Where("prijava_id = ?", p.ID).First(&izbor).Error; err != nil {
		t.Fatal(err)
	}
	if izbor.SelectedSmestajIDs != "[7]" {
		t.Fatalf("choices must be preserved, got %s", izbor.SelectedSmestajIDs)
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected one prijava row, got %d", n)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoIdempotentActiveStatuses(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Idem", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 5}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	for i, st := range []string{"prijavljen", "popeo se", "nije uspeo"} {
		user := models.Korisnik{Username: "u" + strconv.Itoa(i), Password: "x"}
		if err := db.Create(&user).Error; err != nil {
			t.Fatal(err)
		}
		p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: st}
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		var out models.Prijava
		if err := db.Transaction(func(tx *gorm.DB) error {
			var err error
			out, err = CreateConfirmedPrijavaTx(tx, akcija.ID, user.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
			return err
		}); err != nil {
			t.Fatalf("status %s: %v", st, err)
		}
		if out.ID != p.ID || out.Status != st {
			t.Fatalf("status %s should be idempotent no-op, got %+v", st, out)
		}
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoOtkazanoRejectsWhenFull(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Full", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 1}
	guide := models.Korisnik{Username: "gf", Password: "x"}
	filler := models.Korisnik{Username: "fill", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&filler).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: filler.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		return err
	})
	if !errors.Is(err, ErrAkcijaCapacityFull) {
		t.Fatalf("expected capacity full, got %v", err)
	}
	var p models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide.ID).First(&p).Error; err != nil {
		t.Fatal(err)
	}
	if p.Status != "otkazano" {
		t.Fatalf("prijava must stay otkazano, got %s", p.Status)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoFullCapacityIdempotentPrijavljen(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "FullG", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 1}
	guide := models.Korisnik{Username: "gfull", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		return err
	}); err != nil {
		t.Fatalf("active guide on full action should be idempotent success: %v", err)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoOtkazanoRejectsCompletedAction(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Done", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 5, IsCompleted: true}
	guide := models.Korisnik{Username: "gd", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		return err
	})
	if !errors.Is(err, ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected completed error, got %v", err)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoOtkazanoPastDeadlineAllowed(t *testing.T) {
	db := testPrijavaDB(t)
	pastStart := time.Now().Add(-3 * time.Hour)
	akcija := models.Akcija{
		Naziv: "Past", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 5, StartAt: &pastStart,
	}
	guide := models.Korisnik{Username: "gdl", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		p, err := CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
		if err != nil {
			return err
		}
		if p.Status != "prijavljen" {
			t.Fatalf("expected prijavljen after reactivation, got %s", p.Status)
		}
		return nil
	}); err != nil {
		t.Fatalf("guide-auto should skip deadline: %v", err)
	}
}

func TestCreateConfirmedPrijavaTx_GuideAutoConcurrentReactivateOtkazano(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Race", Datum: time.Now().Add(48 * time.Hour), MaxLjudi: 5}
	guide := models.Korisnik{Username: "gr", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide.ID, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errs := make([]error, 4)
	ids := make([]uint, 4)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			errs[idx] = db.Transaction(func(tx *gorm.DB) error {
				p, err := CreateConfirmedPrijavaTx(tx, akcija.ID, guide.ID, time.Now(), ConfirmedPrijavaPolicyGuideAuto)
				if err != nil {
					return err
				}
				ids[idx] = p.ID
				return nil
			})
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatalf("concurrent guide reactivate failed: %v", err)
		}
	}
	for _, id := range ids {
		if id != ids[0] {
			t.Fatalf("expected same prijava id, got %v", ids)
		}
	}
	var p models.Prijava
	if err := db.First(&p, ids[0]).Error; err != nil {
		t.Fatal(err)
	}
	if p.Status != "prijavljen" {
		t.Fatalf("expected prijavljen, got %s", p.Status)
	}
}

func TestEnsurePrijavaIzboriTx_CreatesEmptyOnce(t *testing.T) {
	db := testPrijavaDB(t)
	akcija := models.Akcija{Naziv: "Izbori", Datum: time.Now().Add(48 * time.Hour)}
	user := models.Korisnik{Username: "izbor_u", Password: "x"}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	var first models.PrijavaIzbori
	if err := db.Transaction(func(tx *gorm.DB) error {
		izbor, err := EnsurePrijavaIzboriTx(tx, p.ID)
		first = izbor
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if first.SelectedSmestajIDs != "[]" || first.SelectedPrevozIDs != "[]" || first.SelectedRentItemsRaw != "[]" {
		t.Fatalf("expected empty arrays, got %+v", first)
	}

	var second models.PrijavaIzbori
	if err := db.Transaction(func(tx *gorm.DB) error {
		izbor, err := EnsurePrijavaIzboriTx(tx, p.ID)
		second = izbor
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if second.ID != first.ID {
		t.Fatalf("expected same izbor id, got %d vs %d", second.ID, first.ID)
	}
	var n int64
	db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", p.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected 1 izbor, got %d", n)
	}
}

func TestEnsurePrijavaIzboriTx_PreservesExistingChoices(t *testing.T) {
	db := testPrijavaDB(t)
	p := models.Prijava{AkcijaID: 1, KorisnikID: 1, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	existing := models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: "[9]", SelectedPrevozIDs: "[2]", SelectedRentItemsRaw: "[]",
	}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatal(err)
	}
	var out models.PrijavaIzbori
	if err := db.Transaction(func(tx *gorm.DB) error {
		izbor, err := EnsurePrijavaIzboriTx(tx, p.ID)
		out = izbor
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if out.SelectedSmestajIDs != "[9]" || out.ID != existing.ID {
		t.Fatalf("must preserve existing: %+v", out)
	}
}

func TestEnsurePrijavaIzboriTx_ConcurrentNoDuplicates(t *testing.T) {
	db := testPrijavaDB(t)
	p := models.Prijava{AkcijaID: 2, KorisnikID: 2, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errs := make([]error, 6)
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			errs[idx] = db.Transaction(func(tx *gorm.DB) error {
				_, err := EnsurePrijavaIzboriTx(tx, p.ID)
				return err
			})
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatalf("concurrent ensure failed: %v", err)
		}
	}
	var n int64
	db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", p.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected 1 izbor after concurrent ensure, got %d", n)
	}
}
