package middleware

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ClubHoldMiddleware blokira pristup ako je klub korisnika na hold-u (14+ dana posle isteka subskripcije).
// Superadmin preskače proveru. Zahtev da AuthMiddleware i db budu već u kontekstu.
func ClubHoldMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		if role == "superadmin" {
			c.Next()
			return
		}

		dbAny, exists := c.Get("db")
		if !exists {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
			return
		}
		db := dbAny.(*gorm.DB)

		usernameVal, _ := c.Get("username")
		username, _ := usernameVal.(string)
		if username == "" {
			c.Next()
			return
		}

		var korisnik models.Korisnik
		if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
			c.Next()
			return
		}
		if korisnik.KlubID == nil {
			c.Next()
			return
		}

		_, onHold := helpers.EnsureClubHoldState(db, *korisnik.KlubID)
		if onHold {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Klub je privremeno suspendovan (hold). Kontaktirajte superadmina za aktivaciju."})
			return
		}

		c.Next()
	}
}
