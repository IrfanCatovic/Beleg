package handlers

import (
	"beleg-app/backend/internal/email"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"errors"
	"fmt"
	"log"
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
	Username      string `json:"username"`
	Password      string `json:"password"`
	Email         string `json:"email"`
	FullName      string `json:"fullName"`
	Pol           string `json:"pol"`
	DatumRodjenja string `json:"datumRodjenja"`
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
			"Započeli ste registraciju na PLANINER aplikaciji.\n\n"+
			"Kliknite na link ispod da potvrdite email adresu i završite kreiranje naloga:\n%s\n\n"+
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
		pol := strings.TrimSpace(req.Pol)
		if pol == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pol je obavezan"})
			return
		}
		datumRodjenjaRaw := strings.TrimSpace(req.DatumRodjenja)
		if datumRodjenjaRaw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datum rođenja je obavezan"})
			return
		}
		datumRodjenja, err := time.Parse("2006-01-02", datumRodjenjaRaw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datum rođenja mora biti u formatu YYYY-MM-DD"})
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
		if helpers.IsOpenRegistrationPendingConflict(db, username, emailStr) {
			c.JSON(http.StatusConflict, gin.H{"error": "Registracija sa ovim korisničkim imenom ili emailom je već u toku. Proverite email ili pokušajte kasnije."})
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
			return
		}

		rawToken, tokenHash, err := helpers.GenerateEmailVerificationToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju verifikacionog tokena"})
			return
		}

		pending := models.PendingOpenRegistration{
			Username:      username,
			PasswordHash:  string(hashed),
			Email:         emailStr,
			FullName:      strings.TrimSpace(req.FullName),
			Pol:           pol,
			DatumRodjenja: &datumRodjenja,
			TokenHash:     tokenHash,
			ExpiresAt:     time.Now().Add(24 * time.Hour),
		}
		if err := db.Create(&pending).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju registracije"})
			return
		}

		if err := sendVerificationEmail(pending.Email, rawToken); err != nil {
			log.Printf("RegisterOpen: slanje verifikacionog emaila nije uspelo (proverite SMTP/Resend i APP_PUBLIC_URL): %v", err)
			if delErr := db.Delete(&models.PendingOpenRegistration{}, pending.ID).Error; delErr != nil {
				log.Printf("RegisterOpen: brisanje pending reda nakon neuspešnog slanja: %v", delErr)
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Slanje verifikacionog emaila nije uspelo. Proverite email podešavanja servera (SMTP ili Resend) i APP_PUBLIC_URL."})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "Poslali smo link za potvrdu na email. Nalog nastaje tek nakon što otvorite link.",
		})
	}
}

func verifyEmailFromPending(c *gin.Context, db *gorm.DB, pending *models.PendingOpenRegistration, hash string) {
	if pending.UsedAt != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Email je već potvrđen"})
		return
	}
	if time.Now().After(pending.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token je istekao"})
		return
	}

	now := time.Now()
	err := db.Transaction(func(tx *gorm.DB) error {
		var p models.PendingOpenRegistration
		if err := tx.Where("id = ? AND used_at IS NULL", pending.ID).First(&p).Error; err != nil {
			return err
		}
		if time.Now().After(p.ExpiresAt) {
			return errors.New("expired")
		}
		if p.TokenHash != hash {
			return errors.New("token_mismatch")
		}

		var takenUser models.Korisnik
		if err := helpers.DBWhereUsername(tx, p.Username).First(&takenUser).Error; err == nil {
			return errors.New("username_taken")
		}
		if helpers.IsNonEmptyEmailTaken(tx, p.Email, 0) {
			return errors.New("email_taken")
		}

		korisnik := models.Korisnik{
			Username:        p.Username,
			Password:        p.PasswordHash,
			Role:            "",
			Email:           p.Email,
			FullName:        p.FullName,
			Pol:             p.Pol,
			DatumRodjenja:   p.DatumRodjenja,
			KlubID:          nil,
			EmailVerifiedAt: &now,
		}
		if err := tx.Create(&korisnik).Error; err != nil {
			return err
		}
		return tx.Model(&models.PendingOpenRegistration{}).Where("id = ? AND used_at IS NULL", p.ID).Update("used_at", now).Error
	})

	if err != nil {
		switch err.Error() {
		case "expired":
			c.JSON(http.StatusBadRequest, gin.H{"error": "Token je istekao"})
			return
		case "username_taken", "email_taken":
			c.JSON(http.StatusConflict, gin.H{"error": "Korisničko ime ili email su u međuvremenu zauzeti. Započnite registraciju ponovo."})
			return
		case "token_mismatch":
			c.JSON(http.StatusBadRequest, gin.H{"error": "Token nije validan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri potvrdi email adrese"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email adresa je uspešno potvrđena"})
}

func VerifyEmail(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	rawToken := strings.TrimSpace(c.Query("token"))
	if rawToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token je obavezan"})
		return
	}
	hash := helpers.HashEmailVerificationToken(rawToken)

	var pending models.PendingOpenRegistration
	if err := db.Where("token_hash = ?", hash).First(&pending).Error; err == nil {
		verifyEmailFromPending(c, db, &pending, hash)
		return
	}

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

	var pending models.PendingOpenRegistration
	if err := db.Where("LOWER(email) = ? AND used_at IS NULL", emailStr).
		Order("id DESC").
		First(&pending).Error; err == nil {
		rawToken, tokenHash, err := helpers.GenerateEmailVerificationToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju verifikacionog tokena"})
			return
		}
		exp := time.Now().Add(24 * time.Hour)
		if err := db.Model(&pending).Updates(map[string]interface{}{
			"token_hash": tokenHash,
			"expires_at": exp,
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri osvežavanju tokena"})
			return
		}
		if err := sendVerificationEmail(pending.Email, rawToken); err != nil {
			log.Printf("ResendVerificationEmail (pending registracija): %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Slanje verifikacionog emaila nije uspelo"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Verifikacioni email je poslat."})
		return
	}

	var korisnik models.Korisnik
	if err := db.Where("LOWER(email) = ?", emailStr).First(&korisnik).Error; err != nil {
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
		log.Printf("ResendVerificationEmail (korisnik id=%d): %v", korisnik.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Slanje verifikacionog emaila nije uspelo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Verifikacioni email je poslat."})
}
