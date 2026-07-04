package handlers

import (
	"errors"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testHandlersPrijavaDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.Korisnik{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	database.PostAutoMigrateCreatePrijavaIndexes(db)
	return db
}

func TestCreatePrijavaFromChoices_RejectsWhenFull(t *testing.T) {
	db := testHandlersPrijavaDB(t)
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Full", Datum: future, MaxLjudi: 1}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	existing := models.Korisnik{Username: "existing", Password: "x"}
	requester := models.Korisnik{Username: "newuser", Password: "x"}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: existing.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := createPrijavaFromChoices(tx, akcija.ID, requester, prijavaChoicesPayload{})
		return err
	})
	if !errors.Is(err, helpers.ErrAkcijaCapacityFull) {
		t.Fatalf("expected capacity full, got %v", err)
	}
}

func TestCreatePrijavaFromChoices_RejectsDuplicateUser(t *testing.T) {
	db := testHandlersPrijavaDB(t)
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Dup", Datum: future, MaxLjudi: 0}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	user := models.Korisnik{Username: "dupuser", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := createPrijavaFromChoices(tx, akcija.ID, user, prijavaChoicesPayload{})
		return err
	})
	if !errors.Is(err, helpers.ErrDuplicatePrijava) {
		t.Fatalf("expected duplicate prijava, got %v", err)
	}
}

func TestCreatePrijavaFromChoices_RejectsPastActionDate(t *testing.T) {
	db := testHandlersPrijavaDB(t)
	past := time.Now().AddDate(0, 0, -3)
	akcija := models.Akcija{Naziv: "Past", Datum: past, MaxLjudi: 0}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	user := models.Korisnik{Username: "late", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := createPrijavaFromChoices(tx, akcija.ID, user, prijavaChoicesPayload{})
		return err
	})
	if !errors.Is(err, helpers.ErrSignupClosed) {
		t.Fatalf("expected signup closed, got %v", err)
	}
}

func TestCreatePrijavaFromChoices_SuccessWithinCapacity(t *testing.T) {
	db := testHandlersPrijavaDB(t)
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "OK", Datum: future, MaxLjudi: 5}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	user := models.Korisnik{Username: "okuser", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		p, err := createPrijavaFromChoices(tx, akcija.ID, user, prijavaChoicesPayload{})
		if err != nil {
			return err
		}
		if p.ID == 0 {
			return errors.New("empty prijava id")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
}
