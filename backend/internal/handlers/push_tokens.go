package handlers

import (
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type pushTokenRequest struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform"`
}

func pushTokenKorisnik(c *gin.Context, db *gorm.DB) (*models.Korisnik, bool) {
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return nil, false
	}
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, usernameVal.(string)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return nil, false
	}
	return &korisnik, true
}

// RegisterPushToken upsert-uje Expo push token za ulogovanog korisnika.
func RegisterPushToken(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	korisnik, ok := pushTokenKorisnik(c, db)
	if !ok {
		return
	}

	var req pushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan zahtev"})
		return
	}

	token := strings.TrimSpace(req.Token)
	if token == "" || !strings.HasPrefix(token, "ExponentPushToken[") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan push token"})
		return
	}

	platform := strings.TrimSpace(strings.ToLower(req.Platform))
	if platform != "android" && platform != "ios" {
		platform = ""
	}

	now := time.Now()
	var existing models.PushToken
	err := db.Where("token = ?", token).First(&existing).Error
	if err == nil {
		existing.UserID = korisnik.ID
		existing.Platform = platform
		existing.UpdatedAt = now
		if err := db.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju tokena"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}
	if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju tokena"})
		return
	}

	row := models.PushToken{
		UserID:    korisnik.ID,
		Token:     token,
		Platform:  platform,
		UpdatedAt: now,
	}
	if err := db.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju tokena"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DeletePushToken uklanja push token pri logout-u.
func DeletePushToken(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	korisnik, ok := pushTokenKorisnik(c, db)
	if !ok {
		return
	}

	var req pushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan zahtev"})
		return
	}

	token := strings.TrimSpace(req.Token)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan push token"})
		return
	}

	if err := db.Where("token = ? AND user_id = ?", token, korisnik.ID).Delete(&models.PushToken{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju tokena"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
