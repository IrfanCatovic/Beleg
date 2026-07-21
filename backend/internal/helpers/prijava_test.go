package helpers

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPrijavaDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
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

func TestValidateAkcijaActive_Completed(t *testing.T) {
	akcija := &models.Akcija{IsCompleted: true, Datum: time.Now().Add(24 * time.Hour)}
	if err := ValidateAkcijaActive(akcija); !errors.Is(err, ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected ErrAkcijaAlreadyComplete, got %v", err)
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
