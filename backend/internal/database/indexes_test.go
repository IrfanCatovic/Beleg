package database

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testIndexesDB(t *testing.T) *gorm.DB {
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
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestPostAutoMigrateCreatePrijavaIndexes_NoDuplicatesCreatesIndex(t *testing.T) {
	db := testIndexesDB(t)
	akcija := models.Akcija{Naziv: "A", Datum: time.Now().Add(48 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: 1, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	if err := PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("expected success, got %v", err)
	}

	err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: 1, Status: "prijavljen"}).Error
	if err == nil {
		t.Fatal("expected duplicate insert to fail after unique index")
	}
}

func TestPostAutoMigrateCreatePrijavaIndexes_DuplicatesNotDeletedAndReturnsError(t *testing.T) {
	db := testIndexesDB(t)
	akcija := models.Akcija{Naziv: "Dup", Datum: time.Now().Add(48 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 2; i++ {
		if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: 99, Status: "prijavljen"}).Error; err != nil {
			t.Fatal(err)
		}
	}

	var before int64
	if err := db.Model(&models.Prijava{}).Count(&before).Error; err != nil {
		t.Fatal(err)
	}

	err := PostAutoMigrateCreatePrijavaIndexes(db)
	if !IsDuplicatePrijaveError(err) {
		t.Fatalf("expected DuplicatePrijaveError, got %v", err)
	}
	dupErr, ok := err.(*DuplicatePrijaveError)
	if !ok || dupErr.Groups != 1 {
		t.Fatalf("expected 1 duplicate group, got %#v", err)
	}
	if !strings.Contains(err.Error(), "manual review") || !strings.Contains(err.Error(), "backup") {
		t.Fatalf("error should mention manual review and backup: %q", err.Error())
	}

	var after int64
	if err := db.Model(&models.Prijava{}).Count(&after).Error; err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("row count changed: before=%d after=%d", before, after)
	}
}

func TestMaintenanceCleanupDuplicatePrijave_NotCalledFromStartup(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	appGo := filepath.Join(filepath.Dir(thisFile), "..", "app", "app.go")
	body, err := os.ReadFile(appGo)
	if err != nil {
		t.Fatalf("read app.go: %v", err)
	}
	src := string(body)
	if strings.Contains(src, "PreAutoMigrateCleanupDuplicatePrijave") {
		t.Fatal("app.go must not reference PreAutoMigrateCleanupDuplicatePrijave")
	}
	if strings.Contains(src, "MaintenanceCleanupDuplicatePrijave") {
		t.Fatal("app.go must not reference MaintenanceCleanupDuplicatePrijave")
	}
}

func TestMaintenanceCleanupDuplicatePrijave_RemovesDuplicatesExplicitly(t *testing.T) {
	db := testIndexesDB(t)
	akcija := models.Akcija{Naziv: "Maint", Datum: time.Now().Add(48 * time.Hour)}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: 7, Status: "prijavljen"}).Error; err != nil {
			t.Fatal(err)
		}
	}

	removed, err := MaintenanceCleanupDuplicatePrijave(db)
	if err != nil {
		t.Fatalf("maintenance cleanup: %v", err)
	}
	if removed != 1 {
		t.Fatalf("expected 1 removed row, got %d", removed)
	}

	groups, err := countDuplicatePrijavaGroups(db)
	if err != nil {
		t.Fatal(err)
	}
	if groups != 0 {
		t.Fatalf("expected 0 duplicate groups after maintenance, got %d", groups)
	}
}

func TestCheckDuplicatePendingSignupReadOnly_DetectsDuplicates(t *testing.T) {
	db := testIndexesDB(t)
	for i := 0; i < 2; i++ {
		if err := db.Create(&models.ActionSignupRequest{
			AkcijaID:    1,
			RequesterID: 5,
			Status:      models.ActionSignupRequestPending,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	err := checkDuplicatePendingSignupReadOnly(db)
	if !IsDuplicatePendingSignupError(err) {
		t.Fatalf("expected DuplicatePendingSignupError, got %v", err)
	}
}

func TestDuplicatePrijaveError_DoesNotExposePrivateData(t *testing.T) {
	err := &DuplicatePrijaveError{Groups: 3}
	msg := err.Error()
	if strings.Contains(msg, "korisnik") && strings.Contains(msg, "@") {
		t.Fatalf("error must not expose user identifiers: %q", msg)
	}
	if !errors.Is(err, err) {
		t.Fatal("error should be comparable")
	}
}
