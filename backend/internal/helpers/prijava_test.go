package helpers

import (
	"errors"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPrijavaDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
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
