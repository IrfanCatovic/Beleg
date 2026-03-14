package handlers

import (
	"net/http"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)


func requireSuperadmin(c *gin.Context) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo superadmin može pristupiti"})
		return false
	}
	return true
}

func GetKlubovi(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)
	var klubovi []models.Klubovi
	if err := db.Order("naziv").Find(&klubovi).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju klubova"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"klubovi": klubovi})
}
