package middleware

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// OptionalLoadUserMiddleware učitava korisnika u kontekst ako postoji validan JWT,
// bez prekidanja zahteva kada token nedostaje ili je nevažeći (public rute).
func OptionalLoadUserMiddleware(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := GetTokenFromRequest(c)
		if tokenStr == "" || len(tokenStr) < 10 {
			c.Next()
			return
		}

		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			c.Next()
			return
		}

		username, ok := jwtUsernameClaimValid(claims)
		if !ok {
			c.Next()
			return
		}

		dbAny, ok := c.Get("db")
		if !ok {
			c.Next()
			return
		}
		db, ok := dbAny.(*gorm.DB)
		if !ok {
			c.Next()
			return
		}

		var korisnik models.Korisnik
		if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
			c.Next()
			return
		}
		if korisnik.Role == "deleted" {
			c.Next()
			return
		}

		c.Set(ContextKeyKorisnik, korisnik)
		c.Set(ContextKeyUserID, korisnik.ID)
		if korisnik.KlubID != nil {
			c.Set(ContextKeyKlubID, *korisnik.KlubID)
		}
		c.Set("username", username)
		c.Set("role", korisnik.Role)
		c.Next()
	}
}
