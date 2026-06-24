package jobs

import (
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestRunSubscriptionHoldOnce_SetsHold(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Klubovi{}, &models.Korisnik{}, &models.Obavestenje{}); err != nil {
		t.Fatal(err)
	}
	ends := time.Now().AddDate(0, 0, -20)
	club := models.Klubovi{Naziv: "Expired", SubscriptionEndsAt: &ends}
	if err := db.Create(&club).Error; err != nil {
		t.Fatal(err)
	}

	RunSubscriptionHoldOnce(db)

	var updated models.Klubovi
	if err := db.First(&updated, club.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !updated.OnHold {
		t.Fatal("expected on_hold after immediate job run")
	}
}
