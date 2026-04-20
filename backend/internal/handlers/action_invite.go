package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func actionInvitePublicBaseURL() string {
	base := strings.TrimSpace(os.Getenv("APP_PUBLIC_URL"))
	if base == "" {
		base = strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	}
	if base == "" {
		base = "http://localhost:5173"
	}
	return strings.TrimRight(base, "/")
}

func hasValidActionInviteLink(db *gorm.DB, akcijaID uint, rawToken string) bool {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return false
	}
	hash := helpers.HashActionInviteToken(rawToken)
	var link models.ActionInviteLink
	if err := db.Where("akcija_id = ? AND token_hash = ?", akcijaID, hash).First(&link).Error; err != nil {
		return false
	}
	if link.RevokedAt != nil {
		return false
	}
	if link.ExpiresAt != nil && time.Now().After(*link.ExpiresAt) {
		return false
	}
	return true
}

func createActionInviteLinkForAkcija(db *gorm.DB, akcija models.Akcija) (string, error) {
	rawToken, hash, err := helpers.GenerateActionInviteToken()
	if err != nil {
		return "", err
	}
	var expiresAt *time.Time
	if akcija.RokPrijava != nil {
		deadline := time.Date(akcija.RokPrijava.Year(), akcija.RokPrijava.Month(), akcija.RokPrijava.Day(), 23, 59, 59, 0, akcija.RokPrijava.Location())
		expiresAt = &deadline
	}
	row := models.ActionInviteLink{
		AkcijaID:  akcija.ID,
		TokenHash: hash,
		ExpiresAt: expiresAt,
	}
	if err := db.Create(&row).Error; err != nil {
		return "", err
	}
	return rawToken, nil
}

func CreateOrRegenerateActionInviteLink(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if akcija.Javna {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invite link je predviđen za klupske akcije"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da menjate invite link za ovu akciju"})
		return
	}

	if err := db.Where("akcija_id = ? AND revoked_at IS NULL", akcija.ID).
		Model(&models.ActionInviteLink{}).
		Update("revoked_at", time.Now()).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri gašenju starog invite linka"})
		return
	}

	rawToken, err := createActionInviteLinkForAkcija(db, akcija)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju invite linka"})
		return
	}

	url := fmt.Sprintf("%s/akcije/%d?inviteToken=%s", actionInvitePublicBaseURL(), akcija.ID, rawToken)
	c.JSON(http.StatusOK, gin.H{
		"inviteUrl":   url,
		"inviteToken": rawToken,
	})
}

func RevokeActionInviteLink(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da ugasite invite link"})
		return
	}
	if err := db.Where("akcija_id = ? AND revoked_at IS NULL", akcija.ID).
		Model(&models.ActionInviteLink{}).
		Update("revoked_at", time.Now()).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri gašenju invite linka"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Invite link je ugašen"})
}
