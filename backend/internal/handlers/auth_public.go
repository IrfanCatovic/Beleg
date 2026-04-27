package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"
	"encoding/json"
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
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required"`
	RememberMe bool   `json:"remember_me"`
}

const (
	sessionMaxAgeShort = 24 * 60 * 60          // 1 dan
	sessionMaxAgeLong  = 30 * 24 * 60 * 60     // 30 dana ("ostani prijavljen")
)

func isProfileComplete(k models.Korisnik) bool {
	return strings.TrimSpace(k.Email) != "" &&
		k.EmailVerifiedAt != nil &&
		strings.TrimSpace(k.Pol) != "" &&
		k.DatumRodjenja != nil
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
		if korisnik.Role != "superadmin" && korisnik.KlubID != nil {
			_, onHold := helpers.EnsureClubHoldState(db, *korisnik.KlubID)
			if onHold {
				c.JSON(http.StatusForbidden, gin.H{"error": "Klub je privremeno suspendovan (hold). Kontaktirajte superadmina za aktivaciju."})
				return
			}
		}

		sessionMaxAge := sessionMaxAgeShort
		if req.RememberMe {
			sessionMaxAge = sessionMaxAgeLong
		}

		claims := jwt.MapClaims{
			"username": korisnik.Username,
			"role":     korisnik.Role,
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
		profileIncomplete := !isProfileComplete(korisnik)
		resp := gin.H{
			"role":              korisnik.Role,
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
}

func Logout() gin.HandlerFunc {
	return func(c *gin.Context) {
		cookieSecure := os.Getenv("COOKIE_SECURE") == "true"
		sameSiteNone := os.Getenv("COOKIE_SAMESITE_NONE") == "true"
		middleware.ClearAuthCookie(c, cookieSecure, sameSiteNone)
		c.JSON(http.StatusOK, gin.H{"message": "Odjavljen"})
	}
}
