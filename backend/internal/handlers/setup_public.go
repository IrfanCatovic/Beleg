package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func GetSetupStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var total int64
		if err := db.Model(&models.Korisnik{}).Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri stanja setup-a"})
			return
		}
		var superCount int64
		if err := db.Model(&models.Korisnik{}).Where("role = ?", "superadmin").Count(&superCount).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri superadmin naloga"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"hasUsers":        total > 0,
			"hasSuperadmin":   superCount > 0,
			"needsSuperadmin": superCount == 0,
		})
	}
}

func GetPublicKlubByNaziv(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		naziv := strings.TrimSpace(c.Param("naziv"))
		if naziv == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv kluba je obavezan"})
			return
		}

		var klub models.Klubovi
		if err := db.Where("naziv = ?", naziv).First(&klub).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju kluba"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"klub": gin.H{
				"id":              klub.ID,
				"naziv":           klub.Naziv,
				"adresa":          klub.Adresa,
				"telefon":         klub.Telefon,
				"email":           klub.Email,
				"sediste":         klub.Sediste,
				"web_sajt":        klub.WebSajt,
				"datum_osnovanja": klub.DatumOsnivanja,
				"logoUrl":         klub.LogoURL,
				"createdAt":       klub.CreatedAt,
				"updatedAt":       klub.UpdatedAt,
			},
		})
	}
}

func RegisterSetupAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		username, usernameErr := helpers.ValidateUsername(c.PostForm("username"))
		password := c.PostForm("password")

		if usernameErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": usernameErr.Error()})
			return
		}
		if password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno polje: password"})
			return
		}
		if len(password) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
			return
		}

		var takenSetup models.Korisnik
		if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&takenSetup).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
			return
		}

		var count int64
		if err := db.Model(&models.Korisnik{}).Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri baze"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Registracija prvog admina nije dozvoljena — već postoje korisnici. Koristite /api/register sa admin/sekretar nalogom."})
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
			return
		}

		fullName := strings.TrimSpace(c.PostForm("fullName"))
		imeRoditelja := strings.TrimSpace(c.PostForm("imeRoditelja"))
		pol := strings.TrimSpace(c.PostForm("pol"))
		drzavljanstvo := strings.TrimSpace(c.PostForm("drzavljanstvo"))
		adresa := strings.TrimSpace(c.PostForm("adresa"))
		telefon := strings.TrimSpace(c.PostForm("telefon"))
		email := strings.TrimSpace(c.PostForm("email"))
		brojLicnogDokumenta := strings.TrimSpace(c.PostForm("brojLicnogDokumenta"))
		brojPlaninarskeLegitimacije := strings.TrimSpace(c.PostForm("brojPlaninarskeLegitimacije"))
		brojPlaninarskeMarkice := strings.TrimSpace(c.PostForm("brojPlaninarskeMarkice"))
		izreceneDisciplinskeKazne := strings.TrimSpace(c.PostForm("izreceneDisciplinskeKazne"))
		izborUOrganeSportskogUdruzenja := strings.TrimSpace(c.PostForm("izborUOrganeSportskogUdruzenja"))
		napomene := strings.TrimSpace(c.PostForm("napomene"))

		var datumRodjenja, datumUclanjenja *time.Time
		if s := strings.TrimSpace(c.PostForm("datumRodjenja")); s != "" {
			if t, err := time.Parse("2006-01-02", s); err == nil {
				datumRodjenja = &t
			}
		}
		if s := strings.TrimSpace(c.PostForm("datumUclanjenja")); s != "" {
			if t, err := time.Parse("2006-01-02", s); err == nil {
				datumUclanjenja = &t
			}
		}

		avatarURL := ""
		if files := c.Request.MultipartForm.File["avatar"]; len(files) > 0 {
			file := files[0]
			if err := helpers.ValidateImageFileHeader(file); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna avatar slika: " + err.Error()})
				return
			}
			f, err := file.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju fajla"})
				return
			}
			defer f.Close()

			cld, err := cloudinary.NewFromParams(
				os.Getenv("CLOUDINARY_CLOUD_NAME"),
				os.Getenv("CLOUDINARY_API_KEY"),
				os.Getenv("CLOUDINARY_API_SECRET"),
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri inicijalizaciji Cloudinary-ja"})
				return
			}

			ctx := context.Background()
			uploadParams := uploader.UploadParams{
				PublicID:       fmt.Sprintf("avatari/setup-%s-%d", username, time.Now().Unix()),
				Folder:         helpers.CloudinaryFolderSetup(),
				Transformation: "q_auto:good,f_auto",
			}

			uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u slike: " + err.Error()})
				return
			}
			avatarURL = uploadResult.SecureURL
		}

		korisnik := models.Korisnik{
			Username:                       username,
			Password:                       string(hashed),
			FullName:                       fullName,
			ImeRoditelja:                   imeRoditelja,
			Pol:                            pol,
			DatumRodjenja:                  datumRodjenja,
			Drzavljanstvo:                  drzavljanstvo,
			Adresa:                         adresa,
			Telefon:                        telefon,
			Email:                          email,
			BrojLicnogDokumenta:            brojLicnogDokumenta,
			BrojPlaninarskeLegitimacije:    brojPlaninarskeLegitimacije,
			BrojPlaninarskeMarkice:         brojPlaninarskeMarkice,
			DatumUclanjenja:                datumUclanjenja,
			IzreceneDisciplinskeKazne:      izreceneDisciplinskeKazne,
			IzborUOrganeSportskogUdruzenja: izborUOrganeSportskogUdruzenja,
			Napomene:                       napomene,
			AvatarURL:                      avatarURL,
			Role:                           "admin",
		}

		if err := db.Create(&korisnik).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "Admin uspešno registrovan",
			"role":    "admin",
			"user": gin.H{
				"id":       korisnik.ID,
				"username": korisnik.Username,
				"fullName": korisnik.FullName,
			},
		})
	}
}
