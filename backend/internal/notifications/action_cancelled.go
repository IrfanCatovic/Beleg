package notifications

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/push"

	"gorm.io/gorm"
)

const actionCancelledNotifyBatchSize = 100

// BuildActionCancelledBody gradi plain-text body za action_cancelled.
func BuildActionCancelledBody(naziv, reason string) string {
	name := strings.TrimSpace(naziv)
	r := strings.TrimSpace(reason)
	if name == "" {
		if r == "" {
			return "Planinarska akcija je otkazana."
		}
		return "Planinarska akcija je otkazana. Razlog: " + r
	}
	if r == "" {
		return fmt.Sprintf("„%s” je otkazana.", name)
	}
	return fmt.Sprintf("„%s” je otkazana. Razlog: %s", name, r)
}

// NotifyActionCancelled kreira in-app obavještenja (batch) pa best-effort push.
// Greške ne propagira — caller ostaje na uspješnom cancellation HTTP 200.
func NotifyActionCancelled(db *gorm.DB, akcija *models.Akcija, recipientIDs []uint) {
	if db == nil || akcija == nil || akcija.ID == 0 || len(recipientIDs) == 0 {
		return
	}

	title := "Akcija otkazana"
	body := BuildActionCancelledBody(akcija.Naziv, akcija.CancellationReason)
	link := fmt.Sprintf("/akcije/%d", akcija.ID)
	metaMap := map[string]any{
		"type":        models.ObavestenjeTipActionCancelled,
		"akcijaId":    akcija.ID,
		"isCancelled": true,
	}
	metaBytes, err := json.Marshal(metaMap)
	if err != nil {
		metaBytes = []byte(fmt.Sprintf(`{"type":%q,"akcijaId":%d,"isCancelled":true}`, models.ObavestenjeTipActionCancelled, akcija.ID))
	}
	metadata := string(metaBytes)

	rows := make([]models.Obavestenje, 0, len(recipientIDs))
	for _, uid := range recipientIDs {
		if uid == 0 {
			continue
		}
		rows = append(rows, models.Obavestenje{
			UserID:   uid,
			Type:     models.ObavestenjeTipActionCancelled,
			Title:    title,
			Body:     body,
			Link:     link,
			Metadata: metadata,
		})
	}
	if len(rows) == 0 {
		return
	}

	if err := db.CreateInBatches(rows, actionCancelledNotifyBatchSize).Error; err != nil {
		log.Printf(
			"notifications: action_cancelled DB insert failed actionId=%d recipients=%d phase=db_insert: %v",
			akcija.ID, len(rows), err,
		)
		return
	}

	pushData := map[string]string{
		"type":        models.ObavestenjeTipActionCancelled,
		"akcijaId":    fmt.Sprintf("%d", akcija.ID),
		"isCancelled": "true",
	}
	for _, n := range rows {
		if n.ID == 0 {
			log.Printf(
				"notifications: action_cancelled missing id after insert actionId=%d userId=%d phase=push_send",
				akcija.ID, n.UserID,
			)
			continue
		}
		push.SendObavestenjeToUserWithData(db, n.UserID, n.ID, title, body, pushData)
	}
}
