package helpers

import (
	"strconv"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const HoldDaysAfterSubscriptionEnd = 14
const WarningDaysAfterSubscriptionEnd = 7 // 7 dana posle isteka pošalji upozorenje da će za 7 dana klub na hold


const XClubIDHeader = "X-Club-Id"

func GetEffectiveClubID(c *gin.Context, db *gorm.DB) (clubID uint, ok bool) {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)

	if role != "superadmin" {
		usernameVal, _ := c.Get("username")
		username, _ := usernameVal.(string)
		if username == "" {
			return 0, true
		}
		var korisnik models.Korisnik
		if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
			return 0, true
		}
		if korisnik.KlubID != nil {
			return *korisnik.KlubID, true
		}
		return 0, true
	}


	raw := c.GetHeader(XClubIDHeader)
	if raw == "" {
		return 0, false
	}
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id == 0 {
		return 0, false
	}
	return uint(id), true
}

// EnsureClubHoldState učitava klub, i ako je subskripcija istekla pre više od HoldDaysAfterSubscriptionEnd dana,
// postavlja OnHold = true i čuva. Ako je 7 dana posle isteka (a pre 14), šalje upozorenje adminima jednom.
// Vraća da li je klub na hold-u (i ažurirani klub).
func EnsureClubHoldState(db *gorm.DB, clubID uint) (club *models.Klubovi, onHold bool) {
	var k models.Klubovi
	if err := db.First(&k, clubID).Error; err != nil {
		return nil, false
	}
	club = &k
	if club.SubscriptionEndsAt == nil {
		return club, club.OnHold
	}
	now := time.Now()
	end := *club.SubscriptionEndsAt
	holdDeadline := end.AddDate(0, 0, HoldDaysAfterSubscriptionEnd)
	warningWindowStart := end.AddDate(0, 0, WarningDaysAfterSubscriptionEnd)

	// 7 dana posle isteka: pošalji upozorenje adminima jednom (da će za 7 dana klub na hold ako se ne plati)
	if !now.Before(warningWindowStart) && now.Before(holdDeadline) && club.SubscriptionWarningSentAt == nil {
		var adminIDs []uint
		if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role IN ?", clubID, []string{"admin", "sekretar"}).Pluck("id", &adminIDs).Error; err == nil && len(adminIDs) > 0 {
			title := "Upozorenje: klub će biti pauziran za 7 dana"
			body := "Subskripcija vašeg kluba \"" + club.Naziv + "\" je istekla. Ukoliko se subskripcija ne obnovi, klub će biti privremeno pauziran (hold) za 7 dana i članovi neće moći da se loguju. Kontaktirajte superadmina za produženje."
			notifications.NotifyUsers(db, adminIDs, models.ObavestenjeTipSubskripcija, title, body, "/home")
			t := now
			club.SubscriptionWarningSentAt = &t
			_ = db.Model(club).Update("subscription_warning_sent_at", t)
		}
	}

	if now.After(holdDeadline) && !club.OnHold {
		club.OnHold = true
		_ = db.Save(club)
	}
	return club, club.OnHold
}
