package helpers

import (
	"strconv"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const HoldDaysAfterSubscriptionEnd = 14


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
// postavlja OnHold = true i čuva. Vraća da li je klub na hold-u (i ažurirani klub).
func EnsureClubHoldState(db *gorm.DB, clubID uint) (club *models.Klubovi, onHold bool) {
	var k models.Klubovi
	if err := db.First(&k, clubID).Error; err != nil {
		return nil, false
	}
	club = &k
	if club.SubscriptionEndsAt == nil {
		return club, club.OnHold
	}
	deadline := club.SubscriptionEndsAt.AddDate(0, 0, HoldDaysAfterSubscriptionEnd)
	if time.Now().After(deadline) && !club.OnHold {
		club.OnHold = true
		_ = db.Save(club)
	}
	return club, club.OnHold
}
