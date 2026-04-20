package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func RegisterUser(db *gorm.DB, jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		username, usernameErr := helpers.ValidateUsername(c.PostForm("username"))
		password := c.PostForm("password")
		role := strings.TrimSpace(c.PostForm("role"))

		if role == "superadmin" {
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
			var superCount int64
			if err := db.Model(&models.Korisnik{}).Where("role = ?", "superadmin").Count(&superCount).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri superadmin naloga"})
				return
			}
			if superCount > 0 {
				c.JSON(http.StatusForbidden, gin.H{"error": "Superadmin već postoji"})
				return
			}
			hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
				return
			}
			post := func(keys ...string) string {
				for _, k := range keys {
					if v := strings.TrimSpace(c.PostForm(k)); v != "" {
						return v
					}
				}
				return ""
			}

			fullName := post("fullName", "full_name")
			imeRoditelja := post("imeRoditelja", "ime_roditelja")
			pol := post("pol")
			drzavljanstvo := post("drzavljanstvo")
			adresa := post("adresa")
			telefon := post("telefon")
			email := post("email")
			brojLicnogDokumenta := post("brojLicnogDokumenta", "broj_licnog_dokumenta")
			brojPlaninarskeLegitimacije := post("brojPlaninarskeLegitimacije", "broj_planinarske_legitimacije")
			brojPlaninarskeMarkice := post("brojPlaninarskeMarkice", "broj_planinarske_markice")
			izreceneDisciplinskeKazne := post("izreceneDisciplinskeKazne", "izrecene_disciplinske_kazne")
			izborUOrganeSportskogUdruzenja := post("izborUOrganeSportskogUdruzenja", "izbor_u_organe_sportskog_udruzenja")
			napomene := post("napomene")
			var datumRodjenja, datumUclanjenja *time.Time
			if s := post("datumRodjenja", "datum_rodjenja"); s != "" {
				if t, err := time.Parse("2006-01-02", s); err == nil {
					datumRodjenja = &t
				}
			}
			if s := post("datumUclanjenja", "datum_uclanjenja"); s != "" {
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
					PublicID:       fmt.Sprintf("avatari/register-superadmin-%s-%d", username, time.Now().Unix()),
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
			if strings.TrimSpace(email) != "" && helpers.IsNonEmptyEmailTaken(db, email, 0) {
				c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovom email adresom već postoji"})
				return
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
				Role:                           "superadmin",
			}
			var takenSuper models.Korisnik
			if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&takenSuper).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
				return
			}
			if err := db.Create(&korisnik).Error; err != nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
				return
			}
			c.JSON(http.StatusCreated, gin.H{
				"message": "Superadmin uspešno kreiran",
				"role":    "superadmin",
				"user": gin.H{
					"id":       korisnik.ID,
					"username": korisnik.Username,
					"fullName": korisnik.FullName,
				},
			})
			return
		}

		tokenStr := middleware.GetTokenFromRequest(c)
		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste prijavljeni"})
			return
		}
		if len(tokenStr) < 10 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}
		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}
		roleVal, _ := claims["role"].(string)
		if roleVal != "admin" && roleVal != "sekretar" && roleVal != "superadmin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili sekretar mogu da kreiraju nove korisnike"})
			return
		}
		usernameVal, _ := claims["username"].(string)
		c.Set("role", roleVal)
		c.Set("username", helpers.NormalizeUsername(usernameVal))

		clubID, ok := helpers.GetEffectiveClubID(c, db)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi pre dodavanja korisnika."})
			return
		}
		if clubID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nemate dodeljen klub. Samo admin/sekretar u klubu može da dodaje korisnike."})
			return
		}

		if usernameErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": usernameErr.Error()})
			return
		}
		if password == "" || role == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezna polja: password i role"})
			return
		}
		if len(password) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
			return
		}
		validRoles := map[string]bool{"admin": true, "clan": true, "vodic": true, "blagajnik": true, "sekretar": true, "menadzer-opreme": true}
		if !validRoles[role] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća uloga"})
			return
		}
		if roleVal == "sekretar" && role == "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Sekretar ne može da kreira administratora"})
			return
		}
		if err := helpers.CheckClubLimitsForRegister(db, clubID, role); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
			return
		}

		post := func(keys ...string) string {
			for _, k := range keys {
				if v := strings.TrimSpace(c.PostForm(k)); v != "" {
					return v
				}
			}
			return ""
		}

		fullName := post("fullName", "full_name")
		imeRoditelja := post("imeRoditelja", "ime_roditelja")
		pol := post("pol")
		drzavljanstvo := post("drzavljanstvo")
		adresa := post("adresa")
		telefon := post("telefon")
		email := post("email")
		brojLicnogDokumenta := post("brojLicnogDokumenta", "broj_licnog_dokumenta")
		brojPlaninarskeLegitimacije := post("brojPlaninarskeLegitimacije", "broj_planinarske_legitimacije")
		brojPlaninarskeMarkice := post("brojPlaninarskeMarkice", "broj_planinarske_markice")
		izreceneDisciplinskeKazne := post("izreceneDisciplinskeKazne", "izrecene_disciplinske_kazne")
		izborUOrganeSportskogUdruzenja := post("izborUOrganeSportskogUdruzenja", "izbor_u_organe_sportskog_udruzenja")
		napomene := post("napomene")

		var datumRodjenja, datumUclanjenja *time.Time
		if s := post("datumRodjenja", "datum_rodjenja"); s != "" {
			if t, err := time.Parse("2006-01-02", s); err == nil {
				datumRodjenja = &t
			}
		}
		if s := post("datumUclanjenja", "datum_uclanjenja"); s != "" {
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
			if err := helpers.CheckStorageLimit(db, clubID, file.Size); err != nil {
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
				PublicID:       fmt.Sprintf("avatari/register-%s-%d", username, time.Now().Unix()),
				Folder:         helpers.CloudinaryFolderForClub(clubID),
				Transformation: "q_auto:good,f_auto",
			}

			uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u slike: " + err.Error()})
				return
			}
			avatarURL = uploadResult.SecureURL
			_ = helpers.AddStorageUsage(db, clubID, file.Size)
		}

		if strings.TrimSpace(email) != "" && helpers.IsNonEmptyEmailTaken(db, email, 0) {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovom email adresom već postoji"})
			return
		}

		klubIDPtr := &clubID
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
			Role:                           role,
			KlubID:                         klubIDPtr,
		}

		var takenMember models.Korisnik
		if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&takenMember).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
			return
		}
		if err := db.Create(&korisnik).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "Korisnik uspešno kreiran",
			"role":    role,
			"user": gin.H{
				"id":       korisnik.ID,
				"username": korisnik.Username,
				"fullName": korisnik.FullName,
			},
		})
	}
}
