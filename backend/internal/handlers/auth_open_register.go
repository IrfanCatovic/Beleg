package handlers

import (
	"beleg-app/backend/internal/email"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"fmt"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type openRegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
	FullName string `json:"fullName"`
}

type resendVerificationRequest struct {
	Email string `json:"email"`
}

func appPublicBaseURL() string {
	base := strings.TrimSpace(os.Getenv("APP_PUBLIC_URL"))
	if base == "" {
		base = strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	}
	if base == "" {
		base = "http://localhost:5173"
	}
	return strings.TrimRight(base, "/")
}

func sendVerificationEmail(toEmail string, rawToken string) error {
	verifyURL := fmt.Sprintf("%s/verifikuj-email?token=%s", appPublicBaseURL(), rawToken)
	subject := "Aktivacija naloga – PLANINER"
	body := fmt.Sprintf(
		"Zdravo,\n\n"+
			"Uspešno ste kreirali nalog na PLANINER aplikaciji.\n\n"+
			"Kliknite na link ispod da potvrdite email adresu:\n%s\n\n"+
			"Želimo vam puno osvojenih vrhova i svu sreću.\n\n"+
			"Ako niste vi pokrenuli registraciju, slobodno ignorišite ovu poruku.\n\n"+
			"Planinarski pozdrav,\n"+
			"Team PLANINER\n",
		verifyURL,
	)
	return email.SendToWithTimeout(toEmail, subject, body, 20*time.Second)
}

func createEmailVerificationToken(db *gorm.DB, userID uint) (string, error) {
	rawToken, tokenHash, err := helpers.GenerateEmailVerificationToken()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(24 * time.Hour)
	row := models.EmailVerificationToken{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	}
	if err := db.Create(&row).Error; err != nil {
		return "", err
	}
	return rawToken, nil
}

func RegisterOpen(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req openRegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		username, usernameErr := helpers.ValidateUsername(req.Username)
		if usernameErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": usernameErr.Error()})
			return
		}
		password := strings.TrimSpace(req.Password)
		if len(password) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
			return
		}

		emailStr := strings.ToLower(strings.TrimSpace(req.Email))
		if emailStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email je obavezan"})
			return
		}
		if _, err := mail.ParseAddress(emailStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna email adresa"})
			return
		}

		var existing models.Korisnik
		if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
			return
		}
		if helpers.IsNonEmptyEmailTaken(db, emailStr, 0) {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovom email adresom već postoji"})
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
			return
		}

		korisnik := models.Korisnik{
			Username: username,
			Password: string(hashed),
			Role:     "",
			Email:    emailStr,
			FullName: strings.TrimSpace(req.FullName),
			KlubID:   nil,
		}
		if err := db.Create(&korisnik).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
			return
		}

		rawToken, err := createEmailVerificationToken(db, korisnik.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju verifikacionog tokena"})
			return
		}
		if err := sendVerificationEmail(korisnik.Email, rawToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Nalog je kreiran, ali slanje verifikacionog emaila nije uspelo"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "Nalog je kreiran. Proverite email i potvrdite adresu.",
		})
	}
}

func VerifyEmail(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	rawToken := strings.TrimSpace(c.Query("token"))
	if rawToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token je obavezan"})
		return
	}
	hash := helpers.HashEmailVerificationToken(rawToken)

	var row models.EmailVerificationToken
	if err := db.Where("token_hash = ?", hash).First(&row).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token nije validan"})
		return
	}
	if row.UsedAt != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Email je već potvrđen"})
		return
	}
	if time.Now().After(row.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token je istekao"})
		return
	}

	now := time.Now()
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Korisnik{}).
			Where("id = ? AND email_verified_at IS NULL", row.UserID).
			Update("email_verified_at", now).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.EmailVerificationToken{}).
			Where("id = ?", row.ID).
			Update("used_at", now).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri potvrdi email adrese"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email adresa je uspešno potvrđena"})
}

func ResendVerificationEmail(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	var req resendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}
	emailStr := strings.ToLower(strings.TrimSpace(req.Email))
	if emailStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email je obavezan"})
		return
	}

	var korisnik models.Korisnik
	if err := db.Where("LOWER(email) = ?", emailStr).First(&korisnik).Error; err != nil {
		// Bez otkrivanja da li email postoji.
		c.JSON(http.StatusOK, gin.H{"message": "Ako email postoji u sistemu, verifikacioni link je poslat."})
		return
	}
	if korisnik.EmailVerifiedAt != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Email je već potvrđen."})
		return
	}

	rawToken, err := createEmailVerificationToken(db, korisnik.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju verifikacionog tokena"})
		return
	}
	if err := sendVerificationEmail(korisnik.Email, rawToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Slanje verifikacionog emaila nije uspelo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Verifikacioni email je poslat."})
}
