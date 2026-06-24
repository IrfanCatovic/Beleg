package handlers

import (
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
)

// CurrentUser loads the authenticated korisnik from gin context.
func CurrentUser(c *gin.Context) (models.Korisnik, bool) {
	return AuthUser(c)
}
