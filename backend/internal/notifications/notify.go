package notifications

import (
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// NotifyUsers kreira po jedno obaveštenje za svakog korisnika iz userIDs.
// Ako je userIDs prazan, ništa se ne kreira. Tip: uplata, akcija, zadatak, post, broadcast.
func NotifyUsers(db *gorm.DB, userIDs []uint, notifType, title, body, link string) {
	if len(userIDs) == 0 {
		return
	}
	for _, uid := range userIDs {
		n := models.Obavestenje{
			UserID: uid,
			Type:   notifType,
			Title:  title,
			Body:   body,
			Link:   link,
		}
		_ = db.Create(&n).Error // ignorišemo grešku da ne prekidamo glavnu akciju
	}
}
