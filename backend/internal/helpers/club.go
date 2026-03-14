package helpers

import (
	"strconv"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)


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
