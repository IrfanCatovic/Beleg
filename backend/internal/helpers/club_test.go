package helpers

import (
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"

	"github.com/glebarez/sqlite"
)

func testClubDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Klubovi{}, &models.Korisnik{}, &models.Obavestenje{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestIsClubOnHold(t *testing.T) {
	db := testClubDB(t)
	club := models.Klubovi{Naziv: "Test", OnHold: true}
	if err := db.Create(&club).Error; err != nil {
		t.Fatal(err)
	}
	onHold, err := IsClubOnHold(db, club.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !onHold {
		t.Fatal("expected on hold")
	}
}

func TestProcessClubSubscriptionState_SetsHoldAfterGrace(t *testing.T) {
	db := testClubDB(t)
	ends := time.Now().AddDate(0, 0, -20)
	club := models.Klubovi{Naziv: "Expired", SubscriptionEndsAt: &ends, OnHold: false}
	if err := db.Create(&club).Error; err != nil {
		t.Fatal(err)
	}
	if err := ProcessClubSubscriptionState(db, club.ID); err != nil {
		t.Fatal(err)
	}
	var updated models.Klubovi
	if err := db.First(&updated, club.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !updated.OnHold {
		t.Fatal("expected club on hold after grace period")
	}
}

func TestProcessClubSubscriptionState_SendsWarningOnce(t *testing.T) {
	db := testClubDB(t)
	ends := time.Now().AddDate(0, 0, -10)
	club := models.Klubovi{Naziv: "Warning", SubscriptionEndsAt: &ends, OnHold: false}
	if err := db.Create(&club).Error; err != nil {
		t.Fatal(err)
	}
	admin := models.Korisnik{Username: "admin1", Role: "admin", KlubID: &club.ID}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	if err := ProcessClubSubscriptionState(db, club.ID); err != nil {
		t.Fatal(err)
	}
	var afterFirst models.Klubovi
	if err := db.First(&afterFirst, club.ID).Error; err != nil {
		t.Fatal(err)
	}
	if afterFirst.SubscriptionWarningSentAt == nil {
		t.Fatal("expected warning timestamp")
	}
	if afterFirst.OnHold {
		t.Fatal("should not be on hold yet")
	}
	var count int64
	db.Model(&models.Obavestenje{}).Count(&count)
	if count != 1 {
		t.Fatalf("expected 1 notification, got %d", count)
	}
	if err := ProcessClubSubscriptionState(db, club.ID); err != nil {
		t.Fatal(err)
	}
	var count2 int64
	db.Model(&models.Obavestenje{}).Count(&count2)
	if count2 != 1 {
		t.Fatalf("expected no duplicate warning, got %d notifications", count2)
	}
}

func TestProcessClubSubscriptionState_NoSubscription(t *testing.T) {
	db := testClubDB(t)
	club := models.Klubovi{Naziv: "Free"}
	if err := db.Create(&club).Error; err != nil {
		t.Fatal(err)
	}
	if err := ProcessClubSubscriptionState(db, club.ID); err != nil {
		t.Fatal(err)
	}
	onHold, _ := IsClubOnHold(db, club.ID)
	if onHold {
		t.Fatal("club without subscription should not be put on hold")
	}
}
