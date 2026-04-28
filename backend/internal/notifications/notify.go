package notifications

import (
	"beleg-app/backend/internal/email"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func resolvePublicBaseURL() string {
	candidates := []string{
		os.Getenv("APP_BASE_URL"),
		os.Getenv("PUBLIC_APP_URL"),
		os.Getenv("FRONTEND_URL"),
		os.Getenv("WEBSITE_URL"),
	}
	for _, candidate := range candidates {
		base := strings.TrimSpace(candidate)
		if base == "" {
			continue
		}
		return strings.TrimRight(base, "/")
	}
	return "https://www.planiner.com"
}

// NotifyUsers kreira po jedno obaveštenje za svakog korisnika iz userIDs.
// Ako je userIDs prazan, ništa se ne kreira. Tip: uplata, akcija, zadatak, post, broadcast.
// metadata: JSON string npr. {"postId":1} ili "" ako nema vezanog entiteta.
func NotifyUsers(db *gorm.DB, userIDs []uint, notifType, title, body, link, metadata string) {
	if len(userIDs) == 0 {
		return
	}

	emailSubject := "PLANINER - obavestenje"
	baseURL := resolvePublicBaseURL()

	for _, uid := range userIDs {
		n := models.Obavestenje{
			UserID:   uid,
			Type:     notifType,
			Title:    title,
			Body:     body,
			Link:     link,
			Metadata: metadata,
		}
		if err := db.Create(&n).Error; err != nil {
			continue // best-effort: ne prekidamo glavni tok
		}

		var korisnik models.Korisnik
		if err := db.Select("email").First(&korisnik, uid).Error; err != nil {
			continue
		}
		userEmail := strings.TrimSpace(korisnik.Email)
		if userEmail == "" {
			continue
		}

		notifURL := fmt.Sprintf("/obavestenja/%d", n.ID)
		if baseURL != "" {
			notifURL = baseURL + notifURL
		}
		emailBody := strings.TrimSpace(fmt.Sprintf(
			"%s\n\n%s\n\nLink ka obavestenju:\n%s",
			strings.TrimSpace(title),
			strings.TrimSpace(body),
			notifURL,
		))

		if err := email.SendToWithTimeout(userEmail, emailSubject, emailBody, 15*time.Second); err != nil {
			log.Printf("notifications email send failed for %s: %v", userEmail, err)
		}
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
