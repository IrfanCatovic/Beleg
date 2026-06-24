package middleware

import (
	"beleg-app/backend/internal/apperror"
	"beleg-app/backend/internal/helpers"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ClubHoldMiddleware blokira pristup ako je klub korisnika na hold-u.
// Superadmin preskače proveru. Zahteva LoadUserMiddleware (klubId u contextu).
func ClubHoldMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		if role == "superadmin" {
			c.Next()
			return
		}

		klubIDVal, exists := c.Get(ContextKeyKlubID)
		if !exists {
			c.Next()
			return
		}
		klubID, ok := klubIDVal.(uint)
		if !ok || klubID == 0 {
			c.Next()
			return
		}

		dbAny, exists := c.Get("db")
		if !exists {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
			return
		}
		db := dbAny.(*gorm.DB)

		onHold, err := helpers.IsClubOnHold(db, klubID)
		if err == nil && onHold {
			apperror.Abort(c, apperror.New("CLUB_ON_HOLD", "Klub je privremeno suspendovan (hold). Kontaktirajte superadmina za aktivaciju.", http.StatusForbidden))
			return
		}

		c.Next()
	}
}
