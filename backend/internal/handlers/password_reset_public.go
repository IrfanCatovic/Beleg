package handlers

import (
	"beleg-app/backend/internal/email"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func sendPasswordResetEmail(toEmail string, rawToken string) error {
	resetURL := fmt.Sprintf("%s/reset-lozinka?token=%s", appPublicBaseURL(), rawToken)
	subject := "Reset lozinke – PLANINER"
	body := fmt.Sprintf(
		"Zdravo,\n\n"+
			"Primili smo zahtev za reset lozinke.\n\n"+
			"Kliknite na link ispod da postavite novu lozinku:\n%s\n\n"+
			"Ako niste vi poslali zahtev, slobodno ignorišite ovu poruku.\n\n"+
			"Planinarski pozdrav,\n"+
			"Team PLANINER\n",
		resetURL,
	)
	return email.SendToWithTimeout(toEmail, subject, body, 20*time.Second)
}

func ForgotPassword(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	var req forgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}
	emailStr := strings.ToLower(strings.TrimSpace(req.Email))
	if emailStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email je obavezan"})
		return
	}

	// Uvek vraćamo istu poruku da ne otkrivamo da li email postoji.
	successResp := gin.H{"message": "Ako email postoji u sistemu, poslali smo link za reset lozinke."}

	var korisnik models.Korisnik
	if err := db.Where("LOWER(email) = ?", emailStr).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusOK, successResp)
		return
	}
	if korisnik.EmailVerifiedAt == nil {
		c.JSON(http.StatusOK, successResp)
		return
	}

	rawToken, tokenHash, err := helpers.GenerateEmailVerificationToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju reset tokena"})
		return
	}
	row := models.PasswordResetToken{
		UserID:    korisnik.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(30 * time.Minute),
	}
	if err := db.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju reset tokena"})
		return
	}
	if err := sendPasswordResetEmail(korisnik.Email, rawToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Slanje reset emaila nije uspelo"})
		return
	}

	c.JSON(http.StatusOK, successResp)
}

func ResetPassword(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	var req resetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}
	tokenRaw := strings.TrimSpace(req.Token)
	if tokenRaw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token je obavezan"})
		return
	}
	newPassword := strings.TrimSpace(req.NewPassword)
	if len(newPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
		return
	}

	hash := helpers.HashEmailVerificationToken(tokenRaw)
	var row models.PasswordResetToken
	if err := db.Where("token_hash = ?", hash).First(&row).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token nije validan"})
		return
	}
	if row.UsedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token je već iskorišćen"})
		return
	}
	if time.Now().After(row.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token je istekao"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju lozinke"})
		return
	}
	now := time.Now()
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Korisnik{}).Where("id = ?", row.UserID).Update("password", string(hashed)).Error; err != nil {
			return err
		}
		return tx.Model(&models.PasswordResetToken{}).Where("id = ? AND used_at IS NULL", row.ID).Update("used_at", now).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri resetovanju lozinke"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Lozinka je uspešno promenjena"})
}
