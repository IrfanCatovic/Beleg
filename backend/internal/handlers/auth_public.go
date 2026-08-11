package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/middleware"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required"`
	RememberMe bool   `json:"remember_me"`
}

const (
	sessionMaxAgeShort = 24 * 60 * 60      // 1 dan
	sessionMaxAgeLong  = 30 * 24 * 60 * 60 // 30 dana ("ostani prijavljen")
)

func isProfileComplete(k models.Korisnik) bool {
	return strings.TrimSpace(k.Email) != "" &&
		k.EmailVerifiedAt != nil &&
		strings.TrimSpace(k.Pol) != "" &&
		k.DatumRodjenja != nil
}

func ensureInitialSummitRewardNotification(db *gorm.DB, korisnik models.Korisnik) {
	var existingCount int64
	db.Model(&models.Obavestenje{}).
		Where("user_id = ? AND type = ?", korisnik.ID, models.ObavestenjeTipSummitReward).
		Count(&existingCount)
	if existingCount > 0 {
		return
	}

	var prijava models.Prijava
	if err := db.Preload("Akcija").
		Where("korisnik_id = ? AND status = ?", korisnik.ID, "popeo se").
		Order("prijavljen_at DESC").
		First(&prijava).Error; err != nil {
		return
	}
	if prijava.Akcija.ID == 0 {
		return
	}
	notifications.NotifySummitReward(db, korisnik.ID, prijava.Akcija)
}

func Login(db *gorm.DB, jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		req.Username = helpers.NormalizeUsername(req.Username)
		if req.Username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno korisničko ime"})
			return
		}

		clientIP := c.ClientIP()
		if allowed, lockedUntil := middleware.CheckLoginAllowed(clientIP, req.Username); !allowed {
			retryAfter := int(time.Until(lockedUntil).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Previše neuspešnih pokušaja prijave. Pokušajte ponovo kasnije."})
			return
		}

		var korisnik models.Korisnik
		if err := helpers.DBWhereUsername(db, req.Username).First(&korisnik).Error; err != nil {
			middleware.RegisterLoginFailure(clientIP, req.Username)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Pogrešno korisničko ime ili lozinka"})
			return
		}

		if strings.TrimSpace(korisnik.Password) == "" {
			middleware.RegisterLoginFailure(clientIP, req.Username)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Pogrešno korisničko ime ili lozinka"})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(korisnik.Password), []byte(req.Password)); err != nil {
			middleware.RegisterLoginFailure(clientIP, req.Username)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Pogrešno korisničko ime ili lozinka"})
			return
		}
		middleware.RegisterLoginSuccess(clientIP, req.Username)

		if korisnik.Username != req.Username {
			_ = db.Model(&korisnik).Update("username", req.Username)
			korisnik.Username = req.Username
		}

		if !applySessionUserPolicy(c, db, &korisnik) {
			return
		}

		sessionMaxAge := sessionMaxAgeShort
		if req.RememberMe {
			sessionMaxAge = sessionMaxAgeLong
		}
		issuePlaninerSession(c, db, jwtSecret, korisnik, sessionMaxAge)
	}
}

func Logout() gin.HandlerFunc {
	return func(c *gin.Context) {
		cookieSecure := os.Getenv("COOKIE_SECURE") == "true"
		sameSiteNone := os.Getenv("COOKIE_SAMESITE_NONE") == "true"
		middleware.ClearAuthCookie(c, cookieSecure, sameSiteNone)
		c.JSON(http.StatusOK, gin.H{"message": "Odjavljen"})
	}
}
