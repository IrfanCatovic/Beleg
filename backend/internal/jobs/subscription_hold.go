package jobs

import (
	"log"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// RunSubscriptionHoldJob periodično obrađuje subscription warning/hold za sve klubove sa datumom isteka.
func RunSubscriptionHoldJob(db *gorm.DB) {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	time.Sleep(2 * time.Minute)
	for {
		runSubscriptionHoldOnce(db)
		<-ticker.C
	}
}

func runSubscriptionHoldOnce(db *gorm.DB) {
	var clubIDs []uint
	if err := db.Model(&models.Klubovi{}).
		Where("subscription_ends_at IS NOT NULL").
		Pluck("id", &clubIDs).Error; err != nil {
		log.Println("[Subscription hold job] čitanje klubova:", err)
		return
	}
	if len(clubIDs) == 0 {
		return
	}
	processed := 0
	for _, id := range clubIDs {
		if err := helpers.ProcessClubSubscriptionState(db, id); err != nil {
			log.Printf("[Subscription hold job] klub %d: %v", id, err)
			continue
		}
		processed++
	}
	if processed > 0 {
		log.Printf("[Subscription hold job] obrađeno %d klubova", processed)
	}
}
