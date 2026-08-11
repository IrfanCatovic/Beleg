package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/socialauth"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// applySessionUserPolicy mirrors password-login gates (deleted, club-less role, club hold).
// Writes the error response and returns false when the user cannot receive a session.
func applySessionUserPolicy(c *gin.Context, db *gorm.DB, korisnik *models.Korisnik) bool {
	if korisnik.Role == "deleted" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nalog je deaktiviran."})
		return false
	}
	if korisnik.KlubID == nil && korisnik.Role != "superadmin" && korisnik.Role != "" {
		_ = db.Model(korisnik).Update("role", "").Error
		korisnik.Role = ""
	}
	if korisnik.Role != "superadmin" && korisnik.KlubID != nil {
		_ = helpers.ProcessClubSubscriptionState(db, *korisnik.KlubID)
		onHold, err := helpers.IsClubOnHold(db, *korisnik.KlubID)
		if err == nil && onHold {
			c.JSON(http.StatusForbidden, gin.H{"error": "Klub je privremeno suspendovan (hold). Kontaktirajte superadmina za aktivaciju."})
			return false
		}
	}
	return true
}

// issuePlaninerSession signs the canonical HS256 Planiner JWT, sets the auth cookie,
// and writes the same JSON shape as password login.
// Social auth uses sessionMaxAgeShort (24h) because the request has no rememberMe flag.
func issuePlaninerSession(c *gin.Context, db *gorm.DB, jwtSecret []byte, korisnik models.Korisnik, sessionMaxAge int) {
	claims := jwt.MapClaims{
		"username": korisnik.Username,
		"role":     korisnik.Role,
		"purpose":  socialauth.PurposeSession,
		"exp":      time.Now().Add(time.Duration(sessionMaxAge) * time.Second).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju tokena"})
		return
	}

	cookieSecure := os.Getenv("COOKIE_SECURE") == "true"
	sameSiteNone := os.Getenv("COOKIE_SAMESITE_NONE") == "true"
	middleware.SetAuthCookie(c, tokenString, sessionMaxAge, cookieSecure, sameSiteNone)

	userPayload := gin.H{
		"username":   korisnik.Username,
		"fullName":   korisnik.FullName,
		"avatar_url": korisnik.AvatarURL,
	}
	if korisnik.KlubID != nil {
		userPayload["klubId"] = *korisnik.KlubID
	}
	ensureInitialSummitRewardNotification(db, korisnik)
	profileIncomplete := !isProfileComplete(korisnik)
	resp := gin.H{
		"status":            "authenticated",
		"role":              korisnik.Role,
		"token":             tokenString,
		"user":              userPayload,
		"profileIncomplete": profileIncomplete,
	}
	var rewardNotif models.Obavestenje
	if err := db.Where("user_id = ? AND type = ? AND read_at IS NULL", korisnik.ID, models.ObavestenjeTipSummitReward).
		Order("created_at DESC").
		First(&rewardNotif).Error; err == nil {
		payload := gin.H{
			"notificationId": rewardNotif.ID,
		}
		if strings.TrimSpace(rewardNotif.Link) != "" {
			payload["link"] = strings.TrimSpace(rewardNotif.Link)
		}
		var parsed struct {
			AkcijaID    uint   `json:"akcijaId"`
			AkcijaNaziv string `json:"akcijaNaziv"`
		}
		if strings.TrimSpace(rewardNotif.Metadata) != "" && json.Unmarshal([]byte(rewardNotif.Metadata), &parsed) == nil {
			if parsed.AkcijaID != 0 {
				payload["actionId"] = parsed.AkcijaID
			}
			if strings.TrimSpace(parsed.AkcijaNaziv) != "" {
				payload["actionName"] = strings.TrimSpace(parsed.AkcijaNaziv)
			}
		}
		if _, ok := payload["actionId"]; !ok {
			if actionIDRaw, ok := payload["link"].(string); ok {
				if strings.HasPrefix(actionIDRaw, "/akcije/") {
					part := strings.TrimPrefix(actionIDRaw, "/akcije/")
					if idx := strings.Index(part, "?"); idx >= 0 {
						part = part[:idx]
					}
					if parsedID, err := strconv.Atoi(part); err == nil && parsedID > 0 {
						payload["actionId"] = parsedID
					}
				}
			}
		}
		resp["pendingSummitReward"] = payload
	}
	if profileIncomplete {
		resp["code"] = "PROFILE_INCOMPLETE"
	}
	c.JSON(http.StatusOK, resp)
}
