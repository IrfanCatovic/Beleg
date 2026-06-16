package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
)

// CurrentUser loads the authenticated korisnik from gin context username claim.
func CurrentUser(c *gin.Context) (models.Korisnik, bool) {
	usernameVal, exists := c.Get("username")
	if !exists {
		return models.Korisnik{}, false
	}
	username, _ := usernameVal.(string)
	db := DB(c)

	var user models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&user).Error; err != nil {
		return models.Korisnik{}, false
	}
	return user, true
}
