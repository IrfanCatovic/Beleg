package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AuthUser vraća ulogovanog korisnika iz contexta (LoadUserMiddleware) ili učitava iz baze kao fallback.
func AuthUser(c *gin.Context) (models.Korisnik, bool) {
	if val, exists := c.Get(middleware.ContextKeyKorisnik); exists {
		if k, ok := val.(models.Korisnik); ok {
			return k, true
		}
	}
	usernameVal, exists := c.Get("username")
	if !exists {
		return models.Korisnik{}, false
	}
	username, _ := usernameVal.(string)
	if username == "" {
		return models.Korisnik{}, false
	}
	db := DB(c)
	var user models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&user).Error; err != nil {
		return models.Korisnik{}, false
	}
	return user, true
}

// AuthUserPtr kao AuthUser ali vraća pokazivač (za postojeće getCurrentKorisnik pozive).
func AuthUserPtr(c *gin.Context) (*models.Korisnik, error) {
	user, ok := AuthUser(c)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &user, nil
}
