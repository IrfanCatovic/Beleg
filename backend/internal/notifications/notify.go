package notifications

import (
	"encoding/json"
	"fmt"
	"strings"

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

func NotifySummitReward(db *gorm.DB, userID uint, akcija models.Akcija) {
	if userID == 0 || akcija.ID == 0 {
		return
	}
	actionName := strings.TrimSpace(akcija.Naziv)
	if actionName == "" {
		actionName = "akciju"
	}
	title := "Čestitamo!"
	body := fmt.Sprintf("Uspešno ste popeli akciju %s", actionName)
	metadataBytes, err := json.Marshal(map[string]interface{}{
		"akcijaId":    akcija.ID,
		"akcijaNaziv": actionName,
	})
	if err != nil {
		metadataBytes = []byte(fmt.Sprintf(`{"akcijaId":%d}`, akcija.ID))
	}
	NotifyUsers(
		db,
		[]uint{userID},
		models.ObavestenjeTipSummitReward,
		title,
		body,
		fmt.Sprintf("/akcije/%d?claimReward=1", akcija.ID),
		string(metadataBytes),
	)
}
