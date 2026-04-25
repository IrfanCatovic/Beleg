package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"
	"context"
	"fmt"
	"net/http"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func GetMe(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	c.JSON(200, korisnik)
}

func UpdateMe(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, exists := c.Get("username")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
			return
		}
		dbAny, _ := c.Get("db")
		db := dbAny.(*gorm.DB)

		var korisnik models.Korisnik
		if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
			return
		}

		if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		post := func(k string) string { return strings.TrimSpace(c.PostForm(k)) }
		roleVal, _ := c.Get("role")
		isAdmin := roleVal == "admin" || roleVal == "superadmin"

		if newPassword := post("newPassword"); newPassword != "" {
			if len(newPassword) < 8 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
				return
			}
			hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju lozinke"})
				return
			}
			if err := db.Model(&korisnik).Update("password", string(hashed)).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju lozinke"})
				return
			}
		}

		newUsername := post("username")
		if newUsername == "" {
			newUsername = korisnik.Username
		} else {
			validatedUsername, err := helpers.ValidateUsername(newUsername)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			newUsername = validatedUsername
		}
		if newUsername != korisnik.Username {
			var existing models.Korisnik
			if err := helpers.DBWhereUsername(db, newUsername).First(&existing).Error; err == nil && existing.ID != korisnik.ID {
				c.JSON(http.StatusConflict, gin.H{"error": "Korisničko ime je već zauzeto"})
				return
			}
		}

		fullName := post("fullName")
		imeRoditelja := post("imeRoditelja")
		pol := post("pol")
		drzavljanstvo := post("drzavljanstvo")
		adresa := post("adresa")
		telefon := post("telefon")
		email := post("email")
		newEmailNorm := strings.ToLower(strings.TrimSpace(email))
		currentEmailNorm := strings.ToLower(strings.TrimSpace(korisnik.Email))
		if newEmailNorm == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email je obavezan"})
			return
		}
		if _, err := mail.ParseAddress(newEmailNorm); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna email adresa"})
			return
		}
		if newEmailNorm != "" && newEmailNorm != currentEmailNorm && helpers.IsNonEmptyEmailTaken(db, newEmailNorm, korisnik.ID) {
			c.JSON(http.StatusConflict, gin.H{"error": "Email adresa je već u upotrebi"})
			return
		}
		emailToStore := strings.TrimSpace(email)
		if emailToStore != "" {
			emailToStore = strings.ToLower(emailToStore)
		}
		brojLicnogDokumenta := post("brojLicnogDokumenta")
		brojPlaninarskeLegitimacije := post("brojPlaninarskeLegitimacije")
		brojPlaninarskeMarkice := post("brojPlaninarskeMarkice")
		izreceneDisciplinskeKazne := post("izreceneDisciplinskeKazne")
		izborUOrganeSportskogUdruzenja := post("izborUOrganeSportskogUdruzenja")
		napomene := post("napomene")
		removeAvatar := post("removeAvatar") == "1" || strings.EqualFold(post("removeAvatar"), "true")
		if strings.TrimSpace(pol) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pol je obavezan"})
			return
		}

		var datumRodjenja, datumUclanjenja *time.Time
		if s := post("datumRodjenja"); s != "" {
			if t, err := time.Parse("2006-01-02", s); err == nil {
				datumRodjenja = &t
			}
		}
		if datumRodjenja == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datum rođenja je obavezan"})
			return
		}
		if s := post("datumUclanjenja"); s != "" {
			if t, err := time.Parse("2006-01-02", s); err == nil {
				datumUclanjenja = &t
			}
		}
		if removeAvatar && korisnik.AvatarURL != "" {
			helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), korisnik.AvatarURL)
			korisnik.AvatarURL = ""
		}

		if files := c.Request.MultipartForm.File["avatar"]; len(files) > 0 {
			file := files[0]
			if err := helpers.ValidateImageFileHeader(file); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna avatar slika: " + err.Error()})
				return
			}
			clubIDForFolder := uint(0)
			if korisnik.KlubID != nil {
				clubIDForFolder = *korisnik.KlubID
			}
			if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
				PublicID:       fmt.Sprintf("avatari/%s-%d", newUsername, time.Now().Unix()),
				Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
				Transformation: "q_auto:good,f_auto",
			}

			uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u slike: " + err.Error()})
				return
			}
			helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
			helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), korisnik.AvatarURL)
			korisnik.AvatarURL = uploadResult.SecureURL
		}

		if files := c.Request.MultipartForm.File["coverImage"]; len(files) > 0 {
			file := files[0]
			if err := helpers.ValidateImageFileHeader(file); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna cover slika: " + err.Error()})
				return
			}
			clubIDForFolder := uint(0)
			if korisnik.KlubID != nil {
				clubIDForFolder = *korisnik.KlubID
			}
			if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			f, err := file.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju cover slike"})
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
				PublicID:       fmt.Sprintf("covers/%s-%d", newUsername, time.Now().Unix()),
				Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
				Transformation: "q_auto:good,f_auto",
			}

			uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u cover slike: " + err.Error()})
				return
			}
			helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
			helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), korisnik.CoverImageURL)
			korisnik.CoverImageURL = uploadResult.SecureURL
		}

		updates := map[string]interface{}{
			"username":                      newUsername,
			"full_name":                     fullName,
			"ime_roditelja":                 imeRoditelja,
			"pol":                           pol,
			"drzavljanstvo":                 drzavljanstvo,
			"adresa":                        adresa,
			"telefon":                       telefon,
			"email":                         emailToStore,
			"broj_licnog_dokumenta":         brojLicnogDokumenta,
			"broj_planinarske_legitimacije": brojPlaninarskeLegitimacije,
			"broj_planinarske_markice":      brojPlaninarskeMarkice,
			"datum_rodjenja":                datumRodjenja,
			"datum_uclanjenja":              datumUclanjenja,
		}
		if isAdmin {
			updates["izrecene_disciplinske_kazne"] = izreceneDisciplinskeKazne
			updates["izbor_u_organe_sportskog_udruzenja"] = izborUOrganeSportskogUdruzenja
			updates["napomene"] = napomene
		}
		updates["avatar_url"] = korisnik.AvatarURL
		if korisnik.CoverImageURL != "" {
			updates["cover_image_url"] = korisnik.CoverImageURL
		}
		if coverPosStr := post("coverPositionY"); coverPosStr != "" {
			if pos, err := strconv.ParseFloat(coverPosStr, 64); err == nil {
				if pos < 0 {
					pos = 0
				}
				if pos > 1 {
					pos = 1
				}
				updates["cover_position_y"] = pos
			}
		}
		if coverPosMobStr := post("coverPositionYMobile"); coverPosMobStr != "" {
			if pos, err := strconv.ParseFloat(coverPosMobStr, 64); err == nil {
				if pos < 0 {
					pos = 0
				}
				if pos > 1 {
					pos = 1
				}
				updates["cover_position_y_mobile"] = pos
			}
		}
		if err := db.Model(&korisnik).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju profila"})
			return
		}

		if err := db.Where("id = ?", korisnik.ID).First(&korisnik).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju profila"})
			return
		}

		resp := gin.H{"message": "Profil ažuriran", "korisnik": korisnik}
		if newUsername != username.(string) {
			claims := jwt.MapClaims{
				"username": korisnik.Username,
				"role":     korisnik.Role,
				"exp":      time.Now().Add(time.Hour * 24).Unix(),
			}
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
			tokenString, err := token.SignedString(jwtSecret)
			if err == nil {
				cookieSecure := os.Getenv("COOKIE_SECURE") == "true"
				sameSiteNone := os.Getenv("COOKIE_SAMESITE_NONE") == "true"
				middleware.SetAuthCookie(c, tokenString, 86400, cookieSecure, sameSiteNone)
				resp["role"] = korisnik.Role
				resp["user"] = gin.H{"username": korisnik.Username, "fullName": korisnik.FullName}
				resp["token"] = tokenString
			}
		}
		c.JSON(200, resp)
	}
}

func UpdateMeCoverPosition(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var body struct {
		CoverPositionY       *float64 `json:"coverPositionY"`
		CoverPositionYMobile *float64 `json:"coverPositionYMobile"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan JSON"})
		return
	}
	if body.CoverPositionY == nil && body.CoverPositionYMobile == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pošaljite coverPositionY i/ili coverPositionYMobile (broj 0–1)"})
		return
	}
	clamp01 := func(p float64) float64 {
		if p < 0 {
			return 0
		}
		if p > 1 {
			return 1
		}
		return p
	}
	updates := map[string]interface{}{}
	if body.CoverPositionY != nil {
		updates["cover_position_y"] = clamp01(*body.CoverPositionY)
	}
	if body.CoverPositionYMobile != nil {
		updates["cover_position_y_mobile"] = clamp01(*body.CoverPositionYMobile)
	}
	if err := db.Model(&korisnik).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju pozicije"})
		return
	}
	if err := db.Where("id = ?", korisnik.ID).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju"})
		return
	}
	out := gin.H{
		"message":          "Pozicija sačuvana",
		"coverPositionY":   korisnik.CoverPositionY,
		"cover_position_y": korisnik.CoverPositionY,
	}
	if korisnik.CoverPositionYMobile != nil {
		out["coverPositionYMobile"] = *korisnik.CoverPositionYMobile
		out["cover_position_y_mobile"] = *korisnik.CoverPositionYMobile
	}
	c.JSON(200, out)
}

func UpdateMeCover(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}
	files := c.Request.MultipartForm.File["coverImage"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Očekuje se slika (coverImage)"})
		return
	}
	file := files[0]
	if err := helpers.ValidateImageFileHeader(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna cover slika: " + err.Error()})
		return
	}
	clubIDForFolder := uint(0)
	if korisnik.KlubID != nil {
		clubIDForFolder = *korisnik.KlubID
	}
	if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju cover slike"})
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
		PublicID:       fmt.Sprintf("covers/%s-%d", username, time.Now().Unix()),
		Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
		Transformation: "q_auto:good,f_auto",
	}

	uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u cover slike: " + err.Error()})
		return
	}
	helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
	helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), korisnik.CoverImageURL)
	if err := db.Model(&korisnik).Update("cover_image_url", uploadResult.SecureURL).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju cover slike"})
		return
	}
	c.JSON(200, gin.H{"message": "Cover slika ažurirana", "cover_image_url": uploadResult.SecureURL})
}
