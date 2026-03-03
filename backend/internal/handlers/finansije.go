package handlers

import (
	"net/http"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetTransakcije vraća listu svih transakcija (uplata i isplata).
// Dostupno samo admin i blagajnik.
func GetTransakcije(c *gin.Context) {
	// Provera uloge
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "admin" && role != "blagajnik" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili blagajnik mogu da vide finansije"})
		return
	}

	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	var transakcije []models.Transakcija
	if err := db.Order("datum DESC, created_at DESC").Preload("Korisnik").Find(&transakcije).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju transakcija"})
		return
	}

	c.JSON(http.StatusOK, transakcije)
}
