package handlers

import (
	"errors"
	"net/http"
	"strings"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// UsernameAvailable — javna provera da li je korisničko ime slobodno (case-insensitive).
func UsernameAvailable(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("username"))
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nedostaje parametar username"})
		return
	}
	norm := helpers.NormalizeUsername(raw)
	if norm == "" || len(norm) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeće korisničko ime"})
		return
	}
	if len(norm) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Korisničko ime je predugačko"})
		return
	}

	dbAny, ok := c.Get("db")
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server greška"})
		return
	}
	db := dbAny.(*gorm.DB)

	var k models.Korisnik
	err := helpers.DBWhereUsername(db, norm).First(&k).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"available": true})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"available": false})
}
