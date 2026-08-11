package database

import (
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testEmailIndexDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(testdb.MemoryDSN(t, "email_index")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestAuthIdentity_EmailNormalizedUniqueIndex_NoDuplicates(t *testing.T) {
	db := testEmailIndexDB(t)
	if err := db.Create(&models.Korisnik{Username: "a", Password: "x", Role: "", Email: "one@example.com"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := PostAutoMigrateCreateEmailIndexes(db); err != nil {
		t.Fatal(err)
	}
	err := db.Create(&models.Korisnik{Username: "b", Password: "x", Role: "", Email: "ONE@example.com"}).Error
	if err == nil {
		t.Fatal("expected unique violation for normalized email")
	}
}

func TestAuthIdentity_EmailNormalizedUniqueIndex_BlankEmailsAllowed(t *testing.T) {
	db := testEmailIndexDB(t)
	if err := PostAutoMigrateCreateEmailIndexes(db); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Korisnik{Username: "legacy1", Password: "x", Role: "", Email: ""}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Korisnik{Username: "legacy2", Password: "x", Role: "", Email: "  "}).Error; err != nil {
		t.Fatalf("blank email must remain allowed: %v", err)
	}
}

func TestAuthIdentity_EmailNormalizedUniqueIndex_DuplicatesNotDeleted(t *testing.T) {
	db := testEmailIndexDB(t)
	if err := db.Create(&models.Korisnik{Username: "d1", Password: "x", Role: "", Email: "dup@example.com"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Korisnik{Username: "d2", Password: "x", Role: "", Email: " DUP@example.com "}).Error; err != nil {
		t.Fatal(err)
	}
	err := PostAutoMigrateCreateEmailIndexes(db)
	if !IsDuplicateEmailError(err) {
		t.Fatalf("expected DuplicateEmailError, got %v", err)
	}
	var n int64
	if err := db.Model(&models.Korisnik{}).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("rows deleted or merged: count=%d", n)
	}
	// Index must not have been created — a third duplicate insert still succeeds.
	if err := db.Create(&models.Korisnik{Username: "d3", Password: "x", Role: "", Email: "dup@example.com"}).Error; err != nil {
		t.Fatalf("index was created despite duplicates: %v", err)
	}
}
