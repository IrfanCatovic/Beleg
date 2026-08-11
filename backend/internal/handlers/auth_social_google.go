package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"beleg-app/backend/internal/googleidtoken"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/socialauth"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type googleStartRequest struct {
	IDToken string `json:"idToken"`
}

type googleCompleteRequest struct {
	OnboardingToken string `json:"onboardingToken"`
	Username        string `json:"username"`
	Pol             string `json:"pol"`
	DatumRodjenja   string `json:"datumRodjenja"`
}

type googleLinkRequest struct {
	LinkToken string `json:"linkToken"`
}

func StartGoogleAuth(jwtSecret []byte, verifier googleidtoken.Verifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req googleStartRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}
		if verifier == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google prijava nije konfigurisana"})
			return
		}

		payload, err := verifier.Verify(context.Background(), req.IDToken)
		if err != nil {
			writeGoogleVerifyError(c, err)
			return
		}

		db := DB(c)
		var identity models.AuthIdentity
		err = db.Where("provider = ? AND provider_user_id = ?", models.AuthProviderGoogle, payload.Sub).
			First(&identity).Error
		if err == nil {
			var korisnik models.Korisnik
			if err := db.First(&korisnik, identity.KorisnikID).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Nalog nije pronađen"})
				return
			}
			if !applySessionUserPolicy(c, db, &korisnik) {
				return
			}
			issuePlaninerSession(c, db, jwtSecret, korisnik, sessionMaxAgeShort)
			return
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri Google prijavi"})
			return
		}

		matches, err := korisniciByNormalizedEmail(db, payload.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri Google prijavi"})
			return
		}
		if len(matches) > 1 {
			c.JSON(http.StatusConflict, gin.H{"error": "Email adresa je već u upotrebi"})
			return
		}
		if len(matches) == 1 {
			existing := matches[0]
			if existing.Role == "deleted" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Nalog je deaktiviran."})
				return
			}
			if existing.EmailVerifiedAt != nil {
				if err := linkGoogleIdentityTx(db, existing.ID, payload.Sub); err != nil {
					writeSocialConflict(c, err)
					return
				}
				if !applySessionUserPolicy(c, db, &existing) {
					return
				}
				issuePlaninerSession(c, db, jwtSecret, existing, sessionMaxAgeShort)
				return
			}
			linkToken, signErr := socialauth.SignLinkToken(jwtSecret, models.AuthProviderGoogle, payload.Sub, payload.Email)
			if signErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri Google prijavi"})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"status":    "link_required",
				"code":      "SOCIAL_ACCOUNT_LINK_REQUIRED",
				"linkToken": linkToken,
			})
			return
		}

		onboardingToken, signErr := socialauth.SignOnboardingToken(
			jwtSecret,
			models.AuthProviderGoogle,
			payload.Sub,
			payload.Email,
			payload.Name,
			sanitizeAvatarURL(payload.Picture),
		)
		if signErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri Google prijavi"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":            "onboarding_required",
			"onboardingToken":   onboardingToken,
			"email":             payload.Email,
			"fullName":          strings.TrimSpace(payload.Name),
			"avatarUrl":         sanitizeAvatarURL(payload.Picture),
			"suggestedUsername": socialauth.SuggestUsername(db, payload.Name, payload.Email),
		})
	}
}

func CompleteGoogleOnboarding(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req googleCompleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}
		claims, err := socialauth.ParseOnboardingToken(jwtSecret, req.OnboardingToken)
		if err != nil {
			writeSocialTokenError(c, err)
			return
		}
		if claims.Provider != models.AuthProviderGoogle {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Nevažeći token"})
			return
		}

		username, usernameErr := helpers.ValidateUsername(req.Username)
		if usernameErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": usernameErr.Error()})
			return
		}
		pol := strings.TrimSpace(req.Pol)
		if pol != "M" && pol != "Ž" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pol mora biti M ili Ž"})
			return
		}
		datumRaw := strings.TrimSpace(req.DatumRodjenja)
		if datumRaw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datum rođenja je obavezan"})
			return
		}
		datumRodjenja, err := time.Parse("2006-01-02", datumRaw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datum rođenja mora biti u formatu YYYY-MM-DD"})
			return
		}

		db := DB(c)
		var created models.Korisnik
		err = db.Transaction(func(tx *gorm.DB) error {
			var existingIdentity models.AuthIdentity
			idErr := tx.Where("provider = ? AND provider_user_id = ?", models.AuthProviderGoogle, claims.ProviderUserID).
				First(&existingIdentity).Error
			if idErr == nil {
				return errSocialIdentityExists{KorisnikID: existingIdentity.KorisnikID}
			}
			if !errors.Is(idErr, gorm.ErrRecordNotFound) {
				return idErr
			}

			if helpers.IsNonEmptyEmailTaken(tx, claims.Email, 0) {
				return errSocialEmailTaken{}
			}

			var takenUser models.Korisnik
			if err := helpers.DBWhereUsername(tx, username).First(&takenUser).Error; err == nil {
				return errSocialUsernameTaken{}
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			now := time.Now()
			user := models.Korisnik{
				Username:        username,
				Password:        "",
				Role:            "",
				Email:           claims.Email,
				EmailVerifiedAt: &now,
				FullName:        clampRunes(claims.FullName, 100),
				AvatarURL:       sanitizeAvatarURL(claims.AvatarURL),
				Pol:             pol,
				DatumRodjenja:   &datumRodjenja,
				KlubID:          nil,
			}
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
			identity := models.AuthIdentity{
				KorisnikID:     user.ID,
				Provider:       models.AuthProviderGoogle,
				ProviderUserID: claims.ProviderUserID,
			}
			if err := tx.Create(&identity).Error; err != nil {
				return err
			}
			created = user
			return nil
		})
		if err != nil {
			var exists errSocialIdentityExists
			if errors.As(err, &exists) {
				var korisnik models.Korisnik
				if loadErr := db.First(&korisnik, exists.KorisnikID).Error; loadErr != nil {
					c.JSON(http.StatusConflict, gin.H{"error": "Nalog je već povezan sa Google identitetom"})
					return
				}
				if !applySessionUserPolicy(c, db, &korisnik) {
					return
				}
				issuePlaninerSession(c, db, jwtSecret, korisnik, sessionMaxAgeShort)
				return
			}
			writeSocialConflict(c, err)
			return
		}
		if loadErr := db.First(&created, created.ID).Error; loadErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri Google prijavi"})
			return
		}
		if !applySessionUserPolicy(c, db, &created) {
			return
		}
		issuePlaninerSession(c, db, jwtSecret, created, sessionMaxAgeShort)
	}
}

func LinkGoogleAccount(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req googleLinkRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}
		claims, err := socialauth.ParseLinkToken(jwtSecret, req.LinkToken)
		if err != nil {
			writeSocialTokenError(c, err)
			return
		}
		if claims.Provider != models.AuthProviderGoogle {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Nevažeći token"})
			return
		}

		viewer, ok := AuthUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste prijavljeni"})
			return
		}
		if viewer.Role == "deleted" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Nalog je deaktiviran."})
			return
		}

		currentEmail := strings.ToLower(strings.TrimSpace(viewer.Email))
		if currentEmail == "" || currentEmail != claims.Email {
			c.JSON(http.StatusForbidden, gin.H{"error": "Google nalog ne pripada ovom korisniku"})
			return
		}

		db := DB(c)
		now := time.Now()
		err = db.Transaction(func(tx *gorm.DB) error {
			var existing models.AuthIdentity
			idErr := tx.Where("provider = ? AND provider_user_id = ?", models.AuthProviderGoogle, claims.ProviderUserID).
				First(&existing).Error
			if idErr == nil {
				if existing.KorisnikID != viewer.ID {
					return errSocialIdentityTaken{}
				}
				return tx.Model(&models.Korisnik{}).Where("id = ?", viewer.ID).
					Update("email_verified_at", now).Error
			}
			if !errors.Is(idErr, gorm.ErrRecordNotFound) {
				return idErr
			}
			if err := tx.Create(&models.AuthIdentity{
				KorisnikID:     viewer.ID,
				Provider:       models.AuthProviderGoogle,
				ProviderUserID: claims.ProviderUserID,
			}).Error; err != nil {
				return err
			}
			return tx.Model(&models.Korisnik{}).Where("id = ?", viewer.ID).
				Update("email_verified_at", now).Error
		})
		if err != nil {
			writeSocialConflict(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "authenticated"})
	}
}

func linkGoogleIdentityTx(db *gorm.DB, userID uint, sub string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var existing models.AuthIdentity
		err := tx.Where("provider = ? AND provider_user_id = ?", models.AuthProviderGoogle, sub).
			First(&existing).Error
		if err == nil {
			if existing.KorisnikID != userID {
				return errSocialIdentityTaken{}
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return tx.Create(&models.AuthIdentity{
			KorisnikID:     userID,
			Provider:       models.AuthProviderGoogle,
			ProviderUserID: sub,
		}).Error
	})
}

func korisniciByNormalizedEmail(db *gorm.DB, email string) ([]models.Korisnik, error) {
	n := strings.ToLower(strings.TrimSpace(email))
	if n == "" {
		return nil, nil
	}
	if _, err := mail.ParseAddress(n); err != nil {
		return nil, nil
	}
	var users []models.Korisnik
	if err := db.Where("LOWER(TRIM(email)) = ?", n).Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func sanitizeAvatarURL(raw string) string {
	u := strings.TrimSpace(raw)
	if u == "" {
		return ""
	}
	if utf8.RuneCountInString(u) > 500 {
		return ""
	}
	if !strings.HasPrefix(strings.ToLower(u), "https://") {
		return ""
	}
	return u
}

func clampRunes(s string, max int) string {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	runes := []rune(s)
	return string(runes[:max])
}

func writeGoogleVerifyError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, googleidtoken.ErrNoAudiencesConfigured):
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google prijava nije konfigurisana"})
	case errors.Is(err, googleidtoken.ErrExpired):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Google token je istekao"})
	case errors.Is(err, googleidtoken.ErrWrongAudience):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Google token nije izdat za ovu aplikaciju"})
	case errors.Is(err, googleidtoken.ErrMissingSub):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Google token nema sub"})
	case errors.Is(err, googleidtoken.ErrMissingEmail):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Google token nema email"})
	case errors.Is(err, googleidtoken.ErrEmailUnverified):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Google email nije potvrđen"})
	case errors.Is(err, googleidtoken.ErrInvalidIssuer):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Nevažeći Google ID token"})
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Nevažeći Google ID token"})
	}
}

func writeSocialTokenError(c *gin.Context, err error) {
	if errors.Is(err, socialauth.ErrTokenExpired) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token je istekao"})
		return
	}
	c.JSON(http.StatusUnauthorized, gin.H{"error": "Nevažeći token"})
}

func writeSocialConflict(c *gin.Context, err error) {
	switch {
	case errors.As(err, &errSocialUsernameTaken{}):
		c.JSON(http.StatusConflict, gin.H{"error": "Korisničko ime je već zauzeto"})
	case errors.As(err, &errSocialEmailTaken{}):
		c.JSON(http.StatusConflict, gin.H{"error": "Email adresa je već u upotrebi"})
	case errors.As(err, &errSocialIdentityTaken{}):
		c.JSON(http.StatusConflict, gin.H{"error": "Google nalog je već povezan sa drugim korisnikom"})
	case isSocialUniqueDBError(err):
		c.JSON(http.StatusConflict, gin.H{"error": "Podaci su već zauzeti"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri Google prijavi"})
	}
}

type errSocialUsernameTaken struct{}

func (errSocialUsernameTaken) Error() string { return "username taken" }

type errSocialEmailTaken struct{}

func (errSocialEmailTaken) Error() string { return "email taken" }

type errSocialIdentityTaken struct{}

func (errSocialIdentityTaken) Error() string { return "identity taken" }

type errSocialIdentityExists struct{ KorisnikID uint }

func (errSocialIdentityExists) Error() string { return "identity exists" }

func isSocialUniqueDBError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}
