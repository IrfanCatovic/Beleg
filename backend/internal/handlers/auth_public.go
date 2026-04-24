package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
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

		if korisnik.Role == "deleted" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Nalog je deaktiviran."})
			return
		}
		// Van kluba uloga nije aktivna; zadržavamo samo superadmina kao globalnu ulogu.
		if korisnik.KlubID == nil && korisnik.Role != "superadmin" && korisnik.Role != "" {
			_ = db.Model(&korisnik).Update("role", "").Error
			korisnik.Role = ""
		}
		if korisnik.KlubID == nil && korisnik.Role != "superadmin" && strings.TrimSpace(korisnik.Email) != "" && korisnik.EmailVerifiedAt == nil {
			c.JSON(http.StatusForbidden, gin.H{
				"error":       "Potvrdite email adresu pre prijave.",
				"code":        "EMAIL_NOT_VERIFIED",
				"email":       korisnik.Email,
				"needsVerify": true,
			})
			return
		}

		if korisnik.Role != "superadmin" && korisnik.KlubID != nil {
			_, onHold := helpers.EnsureClubHoldState(db, *korisnik.KlubID)
			if onHold {
				c.JSON(http.StatusForbidden, gin.H{"error": "Klub je privremeno suspendovan (hold). Kontaktirajte superadmina za aktivaciju."})
				return
			}
		}

		claims := jwt.MapClaims{
			"username": korisnik.Username,
			"role":     korisnik.Role,
			"exp":      time.Now().Add(24 * time.Hour).Unix(),
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju tokena"})
			return
		}

		cookieSecure := os.Getenv("COOKIE_SECURE") == "true"
		sameSiteNone := os.Getenv("COOKIE_SAMESITE_NONE") == "true"
		middleware.SetAuthCookie(c, tokenString, 86400, cookieSecure, sameSiteNone)

		userPayload := gin.H{
			"username":   korisnik.Username,
			"fullName":   korisnik.FullName,
			"avatar_url": korisnik.AvatarURL,
		}
		if korisnik.KlubID != nil {
			userPayload["klubId"] = *korisnik.KlubID
		}
		c.JSON(http.StatusOK, gin.H{
			"role":  korisnik.Role,
			"token": tokenString,
			"user":  userPayload,
		})
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
