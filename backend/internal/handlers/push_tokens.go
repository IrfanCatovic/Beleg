package handlers

import (
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/debuglog"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type pushTokenRequest struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform"`
	AppKind  string `json:"appKind"`
}

type pushTokenSummary struct {
	Platform  string    `json:"platform"`
	AppKind   string    `json:"appKind"`
	Suffix    string    `json:"suffix"`
	UpdatedAt time.Time `json:"updatedAt"`
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

func normalizeAppKind(raw string) string {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "expo", "standalone":
		return strings.TrimSpace(strings.ToLower(raw))
	default:
		return ""
	}
}

func listUserPushTokenSummaries(db *gorm.DB, userID uint) []pushTokenSummary {
	var rows []models.PushToken
	if err := db.Where("user_id = ?", userID).Order("updated_at DESC").Find(&rows).Error; err != nil {
		return nil
	}
	out := make([]pushTokenSummary, 0, len(rows))
	for _, row := range rows {
		out = append(out, pushTokenSummary{
			Platform:  row.Platform,
			AppKind:   row.AppKind,
			Suffix:    debuglog.MaskToken(row.Token),
			UpdatedAt: row.UpdatedAt,
		})
	}
	return out
}

func respondPushTokens(c *gin.Context, db *gorm.DB, userID uint) {
	c.JSON(http.StatusOK, gin.H{
		"ok":     true,
		"tokens": listUserPushTokenSummaries(db, userID),
	})
}

// GetMyPushTokens vraća maskirane push tokene ulogovanog korisnika (dijagnostika).
func GetMyPushTokens(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	korisnik, ok := pushTokenKorisnik(c, db)
	if !ok {
		return
	}
	respondPushTokens(c, db, korisnik.ID)
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
	appKind := normalizeAppKind(req.AppKind)

	now := time.Now()
	var existing models.PushToken
	err := db.Where("token = ?", token).First(&existing).Error
	if err == nil {
		existing.UserID = korisnik.ID
		existing.Platform = platform
		existing.AppKind = appKind
		existing.UpdatedAt = now
		if err := db.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju tokena"})
			return
		}
		// #region agent log
		debuglog.Log("push_tokens.go:RegisterPushToken", "token updated", "E", "pre-fix", map[string]interface{}{
			"userId":   korisnik.ID,
			"platform": platform,
			"appKind":  appKind,
			"suffix":   debuglog.MaskToken(token),
		})
		// #endregion
		respondPushTokens(c, db, korisnik.ID)
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
		AppKind:   appKind,
		UpdatedAt: now,
	}
	if err := db.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju tokena"})
		return
	}
	// #region agent log
	debuglog.Log("push_tokens.go:RegisterPushToken", "token created", "E", "pre-fix", map[string]interface{}{
		"userId":   korisnik.ID,
		"platform": platform,
		"appKind":  appKind,
		"suffix":   debuglog.MaskToken(token),
	})
	// #endregion
	respondPushTokens(c, db, korisnik.ID)
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
