package middleware

import (
	"beleg-app/backend/internal/apperror"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	ContextKeyKorisnik = "korisnik"
	ContextKeyUserID   = "userId"
	ContextKeyKlubID   = "klubId"
)

// LoadUserMiddleware učitava Korisnik jednom po zahtevu (posle AuthMiddleware).
func LoadUserMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		usernameVal, exists := c.Get("username")
		if !exists {
			c.Next()
			return
		}
		username, _ := usernameVal.(string)
		if username == "" {
			c.Next()
			return
		}

		dbAny, ok := c.Get("db")
		if !ok {
			apperror.Abort(c, apperror.New("INTERNAL", "Baza nije dostupna", http.StatusInternalServerError))
			return
		}
		db := dbAny.(*gorm.DB)

		var korisnik models.Korisnik
		if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
			apperror.Abort(c, apperror.New("UNAUTHORIZED", "Korisnik nije pronađen", http.StatusUnauthorized))
			return
		}
		if korisnik.Role == "deleted" {
			apperror.Abort(c, apperror.New("UNAUTHORIZED", "Nalog je deaktiviran.", http.StatusUnauthorized))
			return
		}

		c.Set(ContextKeyKorisnik, korisnik)
		c.Set(ContextKeyUserID, korisnik.ID)
		if korisnik.KlubID != nil {
			c.Set(ContextKeyKlubID, *korisnik.KlubID)
		}
		c.Next()
	}
}
