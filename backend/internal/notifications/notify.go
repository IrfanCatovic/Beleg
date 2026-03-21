package notifications

import (
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// NotifyUsers kreira po jedno obaveštenje za svakog korisnika iz userIDs.
// Ako je userIDs prazan, ništa se ne kreira. Tip: uplata, akcija, zadatak, post, broadcast.
// metadata: JSON string npr. {"postId":1} ili "" ako nema vezanog entiteta.
func NotifyUsers(db *gorm.DB, userIDs []uint, notifType, title, body, link, metadata string) {
	if len(userIDs) == 0 {
		return
	}
	for _, uid := range userIDs {
		n := models.Obavestenje{
			UserID:   uid,
			Type:     notifType,
			Title:    title,
			Body:     body,
			Link:     link,
			Metadata: metadata,
		}
		_ = db.Create(&n).Error // ignorišemo grešku da ne prekidamo glavnu akciju
	}
}
