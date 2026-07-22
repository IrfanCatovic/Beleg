package helpers

import (
	"errors"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testAkcijaDeleteDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Akcija{},
		&models.Prijava{},
		&models.ActionSignupRequest{},
	); err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func TestValidateAkcijaCanBeHardDeletedTx_AllowsEmptyActive(t *testing.T) {
	db := testAkcijaDeleteDB(t)
	akcija := models.Akcija{Naziv: "Empty", Datum: time.Now().Add(24 * time.Hour), IsCompleted: false}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		return ValidateAkcijaCanBeHardDeletedTx(tx, locked)
	})
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestValidateAkcijaCanBeHardDeletedTx_CancelledEmptyBlocked(t *testing.T) {
	db := testAkcijaDeleteDB(t)
	akcija := models.Akcija{Naziv: "Cancelled empty", Datum: time.Now().Add(24 * time.Hour), IsCancelled: true}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		return ValidateAkcijaCanBeHardDeletedTx(tx, locked)
	})
	if !errors.Is(err, ErrAkcijaHardDeleteCancelled) {
		t.Fatalf("expected ErrAkcijaHardDeleteCancelled, got %v", err)
	}
}

func TestValidateAkcijaCanBeHardDeletedTx_DomainErrors(t *testing.T) {
	if ErrAkcijaHardDeleteCompleted.Error() != "Završena akcija se ne može trajno obrisati." {
		t.Fatalf("unexpected completed message: %q", ErrAkcijaHardDeleteCompleted.Error())
	}
	if ErrAkcijaHardDeleteCancelled.Error() != "Otkazana akcija se ne može trajno obrisati." {
		t.Fatalf("unexpected cancelled message: %q", ErrAkcijaHardDeleteCancelled.Error())
	}
	if ErrAkcijaHardDeleteHasPrijave.Error() != "Akcija sa učesnicima ili istorijom prijava ne može se trajno obrisati." {
		t.Fatalf("unexpected prijave message: %q", ErrAkcijaHardDeleteHasPrijave.Error())
	}
	if ErrAkcijaHardDeleteHasSignupRequests.Error() != "Akcija sa zahtevima za prijavu ne može se trajno obrisati." {
		t.Fatalf("unexpected signup message: %q", ErrAkcijaHardDeleteHasSignupRequests.Error())
	}
}

func TestValidateAkcijaCanBeHardDeletedTx_OtkazanoBlocks(t *testing.T) {
	db := testAkcijaDeleteDB(t)
	akcija := models.Akcija{Naziv: "Otk", Datum: time.Now().Add(24 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: 1, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		return ValidateAkcijaCanBeHardDeletedTx(tx, locked)
	})
	if !errors.Is(err, ErrAkcijaHardDeleteHasPrijave) {
		t.Fatalf("expected ErrAkcijaHardDeleteHasPrijave, got %v", err)
	}
}
