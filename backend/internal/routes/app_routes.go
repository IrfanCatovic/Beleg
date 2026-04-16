package routes

import (
	"beleg-app/backend/internal/handlers"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"
	"context"
	"fmt"
	"log"
	"net/http"
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

var allowedTezine = map[string]bool{"lako": true, "srednje": true, "tesko": true, "alpinizam": true}

func isValidTezina(tezina string) bool {
	return allowedTezine[strings.TrimSpace(strings.ToLower(tezina))]
}

func getKorisnikByIDOrUsername(db *gorm.DB, param string) *models.Korisnik {
	param = strings.TrimSpace(param)
	if param == "" {
		return nil
	}
	if id, err := strconv.Atoi(param); err == nil {
		var k models.Korisnik
		if db.First(&k, id).Error == nil && k.Role != "deleted" {
			return &k
		}
		return nil
	}
	var k models.Korisnik
	if helpers.DBWhereUsername(db, param).First(&k).Error == nil && k.Role != "deleted" {
		return &k
	}
	return nil
}

func RegisterAppRoutes(r *gin.Engine, db *gorm.DB, jwtSecret []byte) {
	// Public rute
	loginRateLimiter := middleware.NewIPRateLimiter(12, time.Minute)
	cenaZahtevRateLimiter := middleware.NewIPRateLimiter(5, 10*time.Minute)
	usernameAvailableRateLimiter := middleware.NewIPRateLimiter(40, time.Minute)
	registerRateLimiter := middleware.NewIPRateLimiter(8, 10*time.Minute)
	setupAdminRateLimiter := middleware.NewIPRateLimiter(5, 10*time.Minute)

	RegisterSetupPublicRoutes(r, db, setupAdminRateLimiter)
	RegisterAuthPublicRoutes(r, db, jwtSecret, loginRateLimiter)

	// POST /api/cena-zahtev — javna forma za zahtev ponude; šalje email na EMAIL_TO
	r.POST("/api/cena-zahtev", cenaZahtevRateLimiter, handlers.CenaZahtev)

	r.GET("/api/username-available", usernameAvailableRateLimiter, handlers.UsernameAvailable)

	RegisterUsersPublicRoutes(r)

	// PROTECTED RUTE SVE UNUTAR JEDNOG BLOKA
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(jwtSecret))
	protected.Use(middleware.ClubHoldMiddleware())
	{
		RegisterFinanceRoutes(protected)
		RegisterZadatakRoutes(protected)
		RegisterObavestenjaRoutes(protected)
		RegisterClubRoutes(protected)
		RegisterFollowRoutes(protected)
		RegisterPostRoutes(protected)

		RegisterSuperadminRoutes(protected)
		RegisterActionRoutes(r, protected, jwtSecret)

		RegisterRegistrationRoutes(r, db, jwtSecret, registerRateLimiter)

		inviteValidateRateLimiter := middleware.NewIPRateLimiter(40, time.Minute)
		r.POST("/api/invite-code/validate", inviteValidateRateLimiter, handlers.ValidateInviteCode)
		r.POST("/api/register/invite", registerRateLimiter, handlers.RegisterInvite)

		protected.GET("/klub/invite-code", handlers.GetInviteCodeForAdmin)
		protected.POST("/klub/invite-code/regenerate", handlers.RegenerateInviteCode)

		// GET /api/me — trenutno ulogovani korisnik (pun profil za prikaz i podešavanja)
		protected.GET("/me", func(c *gin.Context) {
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
		})

		// PATCH /api/me — ažuriranje profila (sva polja kao pri registraciji). Ne menja role (samo admin može); username se može promeniti ako nije zauzet.
		protected.PATCH("/me", func(c *gin.Context) {
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

			// Opciono: promena lozinke (samo korisnik može da promeni svoju)
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

			// Username: uvek mala slova; ako je poslat i različit od trenutnog, provera jedinstvenosti
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
			brojLicnogDokumenta := post("brojLicnogDokumenta")
			brojPlaninarskeLegitimacije := post("brojPlaninarskeLegitimacije")
			brojPlaninarskeMarkice := post("brojPlaninarskeMarkice")
			izreceneDisciplinskeKazne := post("izreceneDisciplinskeKazne")
			izborUOrganeSportskogUdruzenja := post("izborUOrganeSportskogUdruzenja")
			napomene := post("napomene")

			var datumRodjenja, datumUclanjenja *time.Time
			if s := post("datumRodjenja"); s != "" {
				if t, err := time.Parse("2006-01-02", s); err == nil {
					datumRodjenja = &t
				}
			}
			if s := post("datumUclanjenja"); s != "" {
				if t, err := time.Parse("2006-01-02", s); err == nil {
					datumUclanjenja = &t
				}
			}

			// Opciono: novi avatar na Cloudinary
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

			// Opciono: cover image na Cloudinary
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
				"email":                         email,
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
			if korisnik.AvatarURL != "" {
				updates["avatar_url"] = korisnik.AvatarURL
			}
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

			// Učitaj ažuriranog korisnika (da vratimo role, statistiku itd.)
			if err := db.Where("id = ?", korisnik.ID).First(&korisnik).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju profila"})
				return
			}

			resp := gin.H{"message": "Profil ažuriran", "korisnik": korisnik}
			// Ako je promenjeno korisničko ime, postavi novi JWT u cookie (stari je vezan za stari username)
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
		})

		// PATCH /api/me/cover-position — pozicija covera: coverPositionY (širi ekran, md+), coverPositionYMobile (uža širina)
		protected.PATCH("/me/cover-position", func(c *gin.Context) {
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
		})

		// PATCH /api/me/cover — upload cover slike (multipart: coverImage)
		protected.PATCH("/me/cover", func(c *gin.Context) {
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
		})

		// PATCH /api/korisnici/:id  admin ažurira korisnika (role, disciplinske kazne, izbor u organe, napomene).
		// Admin i sekretar mogu postaviti novu lozinku (samo ako je korisnik zaboravio).
		protected.PATCH("/korisnici/:id", func(c *gin.Context) {
			roleVal, _ := c.Get("role")
			roleStr, _ := roleVal.(string)
			isAdmin := roleStr == "admin" || roleStr == "superadmin"
			isSekretar := roleStr == "sekretar"
			if !isAdmin && !isSekretar {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu menjati korisnika"})
				return
			}
			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(400, gin.H{"error": "Nevažeći ID korisnika"})
				return
			}
			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)
			var korisnik models.Korisnik
			if err := db.First(&korisnik, id).Error; err != nil {
				c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
				return
			}
			if korisnik.Role == "deleted" {
				c.JSON(404, gin.H{"error": "Korisnik je deaktiviran i ne može se menjati"})
				return
			}
			// Admin/sekretar mogu da menjaju samo članove svog kluba; superadmin može bilo koga.
			if roleStr != "superadmin" {
				clubID, ok := helpers.GetEffectiveClubID(c, db)
				if !ok || clubID == 0 {
					c.JSON(http.StatusForbidden, gin.H{"error": "Nemate izabran klub"})
					return
				}
				if korisnik.KlubID == nil || *korisnik.KlubID != clubID {
					c.JSON(http.StatusForbidden, gin.H{"error": "Možete menjati samo članove svog kluba"})
					return
				}
			}
			var body struct {
				Role                           string `json:"role"`
				IzreceneDisciplinskeKazne      string `json:"izreceneDisciplinskeKazne"`
				IzborUOrganeSportskogUdruzenja string `json:"izborUOrganeSportskogUdruzenja"`
				Napomene                       string `json:"napomene"`
				NewPassword                    string `json:"newPassword"`
			}
			_ = c.ShouldBindJSON(&body) // opciono

			// Sekretar može samo da postavi lozinku (zaboravljena lozinka)
			if isSekretar {
				if body.NewPassword == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Sekretar može samo da postavi novu lozinku korisniku (slučaj zaboravljene lozinke)"})
					return
				}
				if len(body.NewPassword) < 8 {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
					return
				}
				hashed, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju lozinke"})
					return
				}
				if err := db.Model(&korisnik).Update("password", string(hashed)).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju lozinke"})
					return
				}
				c.JSON(200, gin.H{"message": "Lozinka uspešno postavljena"})
				return
			}

			// Admin: puna izmena + opciono nova lozinka
			if body.Role == "" {
				body.Role = korisnik.Role
			}
			if body.Role != "" && body.Role != korisnik.Role {
				validRoles := map[string]bool{"admin": true, "clan": true, "vodic": true, "blagajnik": true, "sekretar": true, "menadzer-opreme": true}
				if !validRoles[body.Role] {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća uloga"})
					return
				}
				// Limit admina u klubu: ako postavljamo admin/sekretar, proveri da klub nije već pun
				if korisnik.KlubID != nil && *korisnik.KlubID != 0 {
					if err := helpers.CheckClubLimitsForRoleChange(db, *korisnik.KlubID, korisnik.Role, body.Role); err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
						return
					}
				}
			}
			updates := map[string]interface{}{
				"role":                               body.Role,
				"izrecene_disciplinske_kazne":        body.IzreceneDisciplinskeKazne,
				"izbor_u_organe_sportskog_udruzenja": body.IzborUOrganeSportskogUdruzenja,
				"napomene":                           body.Napomene,
			}
			if body.NewPassword != "" {
				if len(body.NewPassword) < 8 {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
					return
				}
				hashed, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju lozinke"})
					return
				}
				updates["password"] = string(hashed)
			}
			if err := db.Model(&korisnik).Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
				return
			}
			if err := db.First(&korisnik, id).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju"})
				return
			}
			c.JSON(200, gin.H{"message": "Korisnik ažuriran", "korisnik": korisnik})
		})

		// DELETE /api/korisnici/:id — obriši korisnika (admin/sekretar samo u svom klubu, superadmin bilo koga). Ne možeš obrisati samog sebe.
		protected.DELETE("/korisnici/:id", func(c *gin.Context) {
			roleVal, _ := c.Get("role")
			roleStr, _ := roleVal.(string)
			isAdmin := roleStr == "admin" || roleStr == "superadmin"
			isSekretar := roleStr == "sekretar"
			if !isAdmin && !isSekretar {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu da obrišu korisnika"})
				return
			}
			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(400, gin.H{"error": "Nevažeći ID korisnika"})
				return
			}
			db := c.MustGet("db").(*gorm.DB)
			usernameVal, _ := c.Get("username")
			username, _ := usernameVal.(string)

			var korisnik models.Korisnik
			if err := db.First(&korisnik, id).Error; err != nil {
				c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
				return
			}
			if korisnik.Username == username {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete obrisati samog sebe"})
				return
			}
			if korisnik.Role == "deleted" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Korisnik je već deaktiviran"})
				return
			}
			// Admin/sekretar samo u svom klubu; superadmin može bilo koga
			if roleStr != "superadmin" {
				clubID, ok := helpers.GetEffectiveClubID(c, db)
				if !ok || clubID == 0 {
					c.JSON(http.StatusForbidden, gin.H{"error": "Nemate izabran klub"})
					return
				}
				if korisnik.KlubID == nil || *korisnik.KlubID != clubID {
					c.JSON(http.StatusForbidden, gin.H{"error": "Možete obrisati samo članove svog kluba"})
					return
				}
			}

			// Ako korisnik ima transakcije → soft delete (deaktivacija); inače hard delete
			var transCount int64
			if err := db.Model(&models.Transakcija{}).Where("korisnik_id = ?", id).Count(&transCount).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri transakcija"})
				return
			}
			if transCount > 0 {
				// Soft delete: role=deleted, lozinka invalidirana — korisnik ostaje u bazi radi integriteta transakcija, username ostaje zauzet
				randomHash, _ := bcrypt.GenerateFromPassword([]byte(fmt.Sprintf("deleted-%d-%s", time.Now().UnixNano(), korisnik.Username)), bcrypt.DefaultCost)
				if err := db.Model(&korisnik).Updates(map[string]interface{}{
					"role":     "deleted",
					"password": string(randomHash),
				}).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri deaktivaciji korisnika"})
					return
				}
				c.JSON(200, gin.H{"message": "Korisnik je deaktiviran (ima unete transakcije, nalog ostaje za istoriju)"})
				return
			}

			// Hard delete — nema transakcija
			db.Where("user_id = ?", id).Delete(&models.Obavestenje{})
			db.Where("korisnik_id = ?", id).Delete(&models.Prijava{})
			db.Where("korisnik_id = ?", id).Delete(&models.ZadatakKorisnik{})
			db.Model(&models.Transakcija{}).Where("clanarina_korisnik_id = ?", id).Update("clanarina_korisnik_id", nil)
			db.Model(&models.Akcija{}).Where("vodic_id = ?", id).Update("vodic_id", 0)
			db.Model(&models.Akcija{}).Where("added_by_id = ?", id).Update("added_by_id", 0)

			if err := db.Delete(&korisnik).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju korisnika"})
				return
			}
			c.JSON(200, gin.H{"message": "Korisnik je obrisan"})
		})

		// GET /api/korisnici list of users (filtrirano po effective club)
		protected.GET("/korisnici", func(c *gin.Context) {
			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)
			usernameVal, _ := c.Get("username")
			username, _ := usernameVal.(string)
			var currentUser models.Korisnik
			if err := helpers.DBWhereUsername(db, username).First(&currentUser).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			clubID, ok := helpers.GetEffectiveClubID(c, db)
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi.", "korisnici": []models.Korisnik{}})
				return
			}
			if clubID == 0 {
				c.JSON(200, gin.H{"korisnici": []models.Korisnik{}})
				return
			}

			// scope=global: pretraga preko mreže (drugi klubovi), bez privatnih podataka.
			// Vraća samo javna polja + klub naziv/logo, uz poštovanje blokiranja.
			if strings.EqualFold(strings.TrimSpace(c.Query("scope")), "global") {
				type PublicUserDTO struct {
					ID          uint   `json:"id"`
					Username    string `json:"username"`
					FullName    string `json:"fullName,omitempty"`
					AvatarURL   string `json:"avatar_url,omitempty"`
					Role        string `json:"role"`
					KlubNaziv   string `json:"klubNaziv,omitempty"`
					KlubLogoURL string `json:"klubLogoUrl,omitempty"`
				}

				// Sakrij korisnike koji su blokirani u bilo kom smeru sa trenutnim korisnikom.
				var blocks []models.Block
				_ = db.Where("blocker_id = ? OR blocked_id = ?", currentUser.ID, currentUser.ID).Find(&blocks).Error
				blockedSet := map[uint]struct{}{}
				for _, b := range blocks {
					if b.BlockerID == currentUser.ID {
						blockedSet[b.BlockedID] = struct{}{}
					} else if b.BlockedID == currentUser.ID {
						blockedSet[b.BlockerID] = struct{}{}
					}
				}

				var others []models.Korisnik
				// samo drugi klubovi (da follow preko mreže ima poentu)
				if err := db.Preload("Klub").
					Where("klub_id IS NOT NULL AND klub_id <> ? AND role <> ?", clubID, "deleted").
					Find(&others).Error; err != nil {
					c.JSON(500, gin.H{"error": "Greška pri učitavanju korisnika"})
					return
				}

				out := make([]PublicUserDTO, 0, len(others))
				for i := range others {
					if others[i].ID == currentUser.ID {
						continue
					}
					if _, blocked := blockedSet[others[i].ID]; blocked {
						continue
					}
					dto := PublicUserDTO{
						ID:        others[i].ID,
						Username:  others[i].Username,
						FullName:  others[i].FullName,
						AvatarURL: others[i].AvatarURL,
						Role:      others[i].Role,
					}
					if others[i].Klub != nil {
						dto.KlubNaziv = others[i].Klub.Naziv
						dto.KlubLogoURL = others[i].Klub.LogoURL
					}
					out = append(out, dto)
				}

				c.JSON(200, gin.H{"korisnici": out})
				return
			}

			var korisnici []models.Korisnik
			if err := db.Preload("Klub").Where("klub_id = ? AND role != ?", clubID, "deleted").Find(&korisnici).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri učitavanju korisnika"})
				return
			}

			// Sakrij korisnike koji su blokirani u bilo kom smeru sa trenutnim korisnikom.
			var blocks []models.Block
			_ = db.Where("blocker_id = ? OR blocked_id = ?", currentUser.ID, currentUser.ID).Find(&blocks).Error
			blockedSet := map[uint]struct{}{}
			for _, b := range blocks {
				if b.BlockerID == currentUser.ID {
					blockedSet[b.BlockedID] = struct{}{}
				} else if b.BlockedID == currentUser.ID {
					blockedSet[b.BlockerID] = struct{}{}
				}
			}

			filtered := make([]models.Korisnik, 0, len(korisnici))
			for i := range korisnici {
				if korisnici[i].ID != currentUser.ID {
					if _, blocked := blockedSet[korisnici[i].ID]; blocked {
						continue
					}
				}
				if korisnici[i].Klub != nil {
					korisnici[i].KlubNaziv = korisnici[i].Klub.Naziv
					korisnici[i].KlubLogoURL = korisnici[i].Klub.LogoURL
				}
				filtered = append(filtered, korisnici[i])
			}
			c.JSON(200, gin.H{"korisnici": filtered})
		})

		// GET /api/korisnici/:id/info — puni podaci korisnika (samo admin/superadmin i samo iz effective kluba)
		protected.GET("/korisnici/:id/info", func(c *gin.Context) {
			roleVal, _ := c.Get("role")
			roleStr, _ := roleVal.(string)
			if roleStr != "admin" && roleStr != "superadmin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pristup ovim podacima"})
				return
			}
			db := c.MustGet("db").(*gorm.DB)
			clubID, ok := helpers.GetEffectiveClubID(c, db)
			if !ok || clubID == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub"})
				return
			}

			param := c.Param("id")
			korisnik := getKorisnikByIDOrUsername(db, param)
			if korisnik == nil || korisnik.KlubID == nil || *korisnik.KlubID != clubID {
				c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
				return
			}
			c.JSON(http.StatusOK, korisnik)
		})

		// POST /api/korisnici/:id/dodaj-proslu-akciju – admin/superadmin/vodič dodaje novu prošlu akciju (npr. sa drugog društva) i upisuje jednog ili više korisnika kao "popeo se"
		protected.POST("/korisnici/:id/dodaj-proslu-akciju", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" && role != "superadmin" {
				c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič mogu da dodaju prošlu akciju"})
				return
			}

			idStr := c.Param("id")
			korisnikID, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(400, gin.H{"error": "Nevažeći ID korisnika"})
				return
			}

			username, _ := c.Get("username")
			db := c.MustGet("db").(*gorm.DB)
			var currentUser models.Korisnik
			if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&currentUser).Error; err != nil {
				c.JSON(500, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			clubID, ok := helpers.GetEffectiveClubID(c, db)
			if !ok || clubID == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (superadmin) ili niste u klubu."})
				return
			}

			form, err := c.MultipartForm()
			if err != nil {
				c.JSON(400, gin.H{"error": "Nevažeća forma"})
				return
			}

			korisnikIDSet := map[uint]struct{}{uint(korisnikID): {}}
			rawIDFields := append(form.Value["korisnik_ids"], form.Value["korisnik_ids[]"]...)
			for _, rawField := range rawIDFields {
				parts := strings.Split(rawField, ",")
				for _, part := range parts {
					part = strings.TrimSpace(part)
					if part == "" {
						continue
					}
					id64, convErr := strconv.ParseUint(part, 10, 32)
					if convErr != nil || id64 == 0 {
						c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID korisnika u listi"})
						return
					}
					korisnikIDSet[uint(id64)] = struct{}{}
				}
			}

			korisnikIDs := make([]uint, 0, len(korisnikIDSet))
			for id := range korisnikIDSet {
				korisnikIDs = append(korisnikIDs, id)
			}
			if len(korisnikIDs) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Potrebno je izabrati bar jednog člana"})
				return
			}

			var korisnici []models.Korisnik
			if err := db.Where("id IN ?", korisnikIDs).Find(&korisnici).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju korisnika"})
				return
			}
			if len(korisnici) != len(korisnikIDs) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Jedan ili više korisnika nisu pronađeni"})
				return
			}
			for _, korisnik := range korisnici {
				if korisnik.Role == "deleted" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Nije moguće dodati deaktiviranog korisnika"})
					return
				}
				if korisnik.KlubID == nil || *korisnik.KlubID != clubID {
					c.JSON(http.StatusForbidden, gin.H{"error": "Možete dodati prošlu akciju samo članovima iz izabranog kluba"})
					return
				}
			}

			naziv := c.PostForm("naziv")
			planina := strings.TrimSpace(c.PostForm("planina"))
			vrh := c.PostForm("vrh")
			datumStr := c.PostForm("datum")
			opis := c.PostForm("opis")
			tezina := c.PostForm("tezina")
			kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
			duzinaStazeKmStr := c.PostForm("duzinaStazeKm")
			visinaVrhMStr := c.PostForm("visinaVrhM")
			zimskiUsponStr := c.PostForm("zimskiUspon")
			vodicIDStr := c.PostForm("vodic_id")
			drugiVodicIme := c.PostForm("drugi_vodic_ime")
			// Checkbox: samo ako je eksplicitno "false" → samo profil; inače i u istoriju kluba (podrazumevano true)
			rawDodaj := c.PostForm("dodaj_u_istoriju_kluba")
			dodajUIstorijuKluba := strings.TrimSpace(strings.ToLower(rawDodaj)) != "false"
			javnaPast := strings.ToLower(strings.TrimSpace(c.PostForm("javna"))) == "true"
			log.Printf("AddPastAction: dodaj_u_istoriju_kluba='%s' → parsed=%v", rawDodaj, dodajUIstorijuKluba)

			if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
				c.JSON(400, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
				return
			}
			if !isValidTezina(tezina) {
				c.JSON(400, gin.H{"error": "Izaberi težinu od ponuđenih"})
				return
			}

			datum, err := time.Parse("2006-01-02", datumStr)
			if err != nil {
				c.JSON(400, gin.H{"error": "Datum mora biti YYYY-MM-DD"})
				return
			}

			kumulativniUsponM, err := strconv.Atoi(kumulativniUsponMStr)
			if err != nil || kumulativniUsponM < 0 {
				c.JSON(400, gin.H{"error": "Kumulativni uspon mora biti ceo pozitivan broj (metri)"})
				return
			}

			duzinaStazeKm, err := strconv.ParseFloat(duzinaStazeKmStr, 64)
			if err != nil || duzinaStazeKm < 0 {
				c.JSON(400, gin.H{"error": "Dužina staze mora biti pozitivan broj (km)"})
				return
			}

			var visinaVrhM int
			if strings.TrimSpace(visinaVrhMStr) != "" {
				visinaVrhM, err = strconv.Atoi(visinaVrhMStr)
				if err != nil || visinaVrhM < 0 {
					c.JSON(400, gin.H{"error": "Visina vrha mora biti ceo pozitivan broj (metri)"})
					return
				}
			}

			zimskiUspon := strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"

			var vodicID uint
			if vodicIDStr != "" {
				if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
					vodicID = uint(vID)
				}
			}

			akcija := models.Akcija{
				Naziv:                    naziv,
				Planina:                  planina,
				Vrh:                      vrh,
				Datum:                    datum,
				Opis:                     opis,
				Tezina:                   tezina,
				UkupnoMetaraUsponaAkcija: kumulativniUsponM,
				UkupnoKmAkcija:           duzinaStazeKm,
				VisinaVrhM:               visinaVrhM,
				ZimskiUspon:              zimskiUspon,
				SlikaURL:                 "",
				IsCompleted:              true,
				Javna:                    javnaPast,
				KlubID:                   &clubID,
				VodicID:                  vodicID,
				DrugiVodicIme:            strings.TrimSpace(drugiVodicIme),
				AddedByID:                currentUser.ID,
				UIstorijiKluba:           dodajUIstorijuKluba,
			}

			if err := db.Create(&akcija).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri čuvanju akcije"})
				return
			}

			files := form.File["slika"]
			if len(files) > 0 {
				file := files[0]
				if err := helpers.ValidateImageFileHeader(file); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna slika akcije: " + err.Error()})
					return
				}
				clubIDForFolder := uint(0)
				if akcija.KlubID != nil {
					clubIDForFolder = *akcija.KlubID
				}
				if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
					return
				}
				f, err := file.Open()
				if err != nil {
					c.JSON(500, gin.H{"error": "Greška pri čitanju fajla"})
					return
				}
				defer f.Close()
				cld, err := cloudinary.NewFromParams(
					os.Getenv("CLOUDINARY_CLOUD_NAME"),
					os.Getenv("CLOUDINARY_API_KEY"),
					os.Getenv("CLOUDINARY_API_SECRET"),
				)
				if err != nil {
					c.JSON(500, gin.H{"error": "Greška pri inicijalizaciji Cloudinary-ja"})
					return
				}
				ctx := context.Background()
				uploadParams := uploader.UploadParams{
					PublicID:       fmt.Sprintf("akcije/%d", akcija.ID),
					Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
					Transformation: "q_auto:good,f_auto",
				}
				uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
				if err != nil {
					c.JSON(500, gin.H{"error": "Greška pri upload-u na Cloudinary: " + err.Error()})
					return
				}
				helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
				akcija.SlikaURL = uploadResult.SecureURL
				db.Save(&akcija)
			}

			prijave := make([]models.Prijava, 0, len(korisnici))
			for _, korisnik := range korisnici {
				prijave = append(prijave, models.Prijava{
					AkcijaID:   akcija.ID,
					KorisnikID: korisnik.ID,
					Status:     "popeo se",
				})
			}
			if err := db.Create(&prijave).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri dodavanju prijava"})
				return
			}

			for i := range korisnici {
				korisnici[i].UkupnoKmKorisnik += akcija.UkupnoKmAkcija
				korisnici[i].UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
				korisnici[i].BrojPopeoSe += 1
				if err := db.Save(&korisnici[i]).Error; err != nil {
					c.JSON(500, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
					return
				}
			}

			c.JSON(200, gin.H{
				"message":       "Prošla akcija dodata",
				"korisnikIds":   korisnikIDs,
				"brojKorisnika": len(korisnikIDs),
			})
		})

	}

}
