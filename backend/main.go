package main

import (
	"beleg-app/backend/internal/handlers"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/jobs"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/internal/routes"
	"beleg-app/backend/internal/seed"
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
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	Role  string `json:"role"`
	User  struct {
		Username string `json:"username"`
		FullName string `json:"fullName"`
	} `json:"user"`
}

var allowedTezine = map[string]bool{"lako": true, "srednje": true, "tesko": true, "alpinizam": true}

func isValidTezina(tezina string) bool {
	return allowedTezine[strings.TrimSpace(strings.ToLower(tezina))]
}

func main() {
	r := gin.Default()
	err := godotenv.Load()
	if err != nil {
		log.Println("GREŠKA: .env fajl NIJE UČITAN! Razlog:", err)
	} else {
		log.Println("OK: .env fajl je učitan")
		log.Println("DB_PASSWORD iz env:", os.Getenv("DB_PASSWORD")) 
	}

	
	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:5173,http://127.0.0.1:5173"
	}
	originSet := map[string]bool{"http://localhost:5173": true, "http://127.0.0.1:5173": true}
	var origins []string
	for _, o := range strings.Split(corsOrigins, ",") {
		o = strings.TrimSpace(o)
		if o != "" && !originSet[o] {
			originSet[o] = true
			origins = append(origins, o)
		}
	}
	origins = append([]string{"http://localhost:5173", "http://127.0.0.1:5173"}, origins...)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Club-Id"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_SSLMODE"),
		os.Getenv("DB_TIMEZONE"),
	)

	// Konekcija na bazu
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Ne mogu da se povežem sa bazom:", err)
	} else {
		log.Println("Uspješno povezan sa bazom!")
		log.Print(".env je ucitan")
		log.Println("Cloud name:", os.Getenv("CLOUDINARY_CLOUD_NAME"))
	}

	fmt.Println("Uspješno povezan sa bazom!")

	// AutoMigrate kreira ili ažurira tabele
	err = db.AutoMigrate(
		&models.Akcija{},
		&models.Prijava{},
		&models.Korisnik{},
		&models.Transakcija{},
		&models.Zadatak{},
		&models.ZadatakKorisnik{},
		&models.Obavestenje{},
		&models.Klubovi{},
		&models.CloudinaryPendingDelete{},
	)
	if err != nil {
		log.Fatal("Greška pri automigraciji tabela:", err)
	}
	log.Println("Tabele su migrirane (akcije, prijave, korisnici, transakcije, zadaci, zadatak_korisnici, obavestenja, klubovi)")

	// Seed: default klub + dodela postojećih korisnika (jednokratno pri prvom startu)
	seed.RunIfEmpty(db)

	// Inject db u Gin context
	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	})

	// Public rute

	r.GET("/api/setup/status", func(c *gin.Context) {
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
			// dok god nema nijednog superadmin-a, frontend treba da ide na /register-superadmin
			"needsSuperadmin": superCount == 0,
		})
	})

	// POST /api/setup/admin (RegisterAdmin) kreiranje prvog admina prema modelu Korisnik
	// Obavezno: username, password. Ostalo opciono (multipart/form-data + opciono avatar).
	r.POST("/api/setup/admin", func(c *gin.Context) {
		if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		username := strings.TrimSpace(c.PostForm("username"))
		password := c.PostForm("password")

		if username == "" || password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezna polja: username i password (prema modelu Korisnik)"})
			return
		}
		if len(password) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
			return
		}

		// Samo ako nema korisnika  prvi korisnik mora biti admin
		var count int64
		if err := db.Model(&models.Korisnik{}).Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri baze"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Registracija prvog admina nije dozvoljena — već postoje korisnici. Koristite /api/register sa admin/sekretar nalogom."})
			return
		}

		// Hash lozinke
		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
			return
		}

		// Opciona polja iz modela Korisnik
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
			Username:                    username,
			Password:                    string(hashed),
			FullName:                    fullName,
			ImeRoditelja:                imeRoditelja,
			Pol:                         pol,
			DatumRodjenja:               datumRodjenja,
			Drzavljanstvo:               drzavljanstvo,
			Adresa:                      adresa,
			Telefon:                     telefon,
			Email:                       email,
			BrojLicnogDokumenta:         brojLicnogDokumenta,
			BrojPlaninarskeLegitimacije: brojPlaninarskeLegitimacije,
			BrojPlaninarskeMarkice:      brojPlaninarskeMarkice,
			DatumUclanjenja:             datumUclanjenja,
			IzreceneDisciplinskeKazne:   izreceneDisciplinskeKazne,
			IzborUOrganeSportskogUdruzenja: izborUOrganeSportskogUdruzenja,
			Napomene:                    napomene,
			AvatarURL:                   avatarURL,
			Role:                        "admin",
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
	})

	// POST /login login korisnika i dobijanje JWT tokena
	r.POST("/login", func(c *gin.Context) {
		var req struct {
			Username string `json:"username" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		var korisnik models.Korisnik
		if err := db.Where("username = ?", req.Username).First(&korisnik).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Pogrešno korisničko ime ili lozinka"})
			return
		}

		// Proveri lozinku
		if err := bcrypt.CompareHashAndPassword([]byte(korisnik.Password), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Pogrešno korisničko ime ili lozinka"})
			return
		}

		// Ako nije superadmin, proveri da klub nije na hold-u (14+ dana posle isteka subskripcije)
		if korisnik.Role != "superadmin" && korisnik.KlubID != nil {
			_, onHold := helpers.EnsureClubHoldState(db, *korisnik.KlubID)
			if onHold {
				c.JSON(http.StatusForbidden, gin.H{"error": "Klub je privremeno suspendovan (hold). Kontaktirajte superadmina za aktivaciju."})
				return
			}
		}

		// Generiši JWT token
		claims := jwt.MapClaims{
			"username": korisnik.Username,
			"role":     korisnik.Role,
			"exp":      time.Now().Add(time.Hour * 24).Unix(),
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju tokena"})
			return
		}

		// Vrati odgovor
		c.JSON(http.StatusOK, LoginResponse{
			Token: tokenString,
			Role:  korisnik.Role,
			User: struct {
				Username string `json:"username"`
				FullName string `json:"fullName"`
			}{
				Username: korisnik.Username,
				FullName: korisnik.FullName,
			},
		})
	})

	// POST /api/cena-zahtev — javna forma za zahtev ponude; šalje email na EMAIL_TO
	r.POST("/api/cena-zahtev", handlers.CenaZahtev)

	// Javna ruta — detalji akcije (za deljenje linka; vraća i vodiča i ko je dodao)
	// GET /api/akcije/:id  detalji su javni (ruta registrovana iznad, van protected)
	r.GET("/api/akcije/:id", func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
			return
		}
		dbAny, _ := c.Get("db")
		db := dbAny.(*gorm.DB)
		var akcija models.Akcija
		if err := db.First(&akcija, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Akcija nije pronađena"})
			return
		}
		resp := gin.H{
			"id": akcija.ID, "naziv": akcija.Naziv, "planina": akcija.Planina, "vrh": akcija.Vrh, "datum": akcija.Datum,
			"opis": akcija.Opis, "tezina": akcija.Tezina, "slikaUrl": akcija.SlikaURL,
			"createdAt": akcija.CreatedAt, "updatedAt": akcija.UpdatedAt,
			"isCompleted": akcija.IsCompleted, "kumulativniUsponM": akcija.UkupnoMetaraUsponaAkcija,
			"duzinaStazeKm": akcija.UkupnoKmAkcija, "visinaVrhM": akcija.VisinaVrhM, "zimskiUspon": akcija.ZimskiUspon,
			"vodicId": akcija.VodicID,
			"drugiVodicIme": akcija.DrugiVodicIme, "addedById": akcija.AddedByID,
			"javna": akcija.Javna,
		}
		if akcija.Javna && akcija.KlubID != nil {
			var klub models.Klubovi
			if db.First(&klub, *akcija.KlubID).Error == nil {
				resp["klubNaziv"] = klub.Naziv
			}
		}
		if akcija.VodicID > 0 {
			var v models.Korisnik
			if db.First(&v, akcija.VodicID).Error == nil {
				resp["vodic"] = gin.H{"fullName": v.FullName, "username": v.Username}
			}
		}
		if akcija.AddedByID > 0 {
			var a models.Korisnik
			if db.First(&a, akcija.AddedByID).Error == nil {
				resp["addedBy"] = gin.H{"fullName": a.FullName, "username": a.Username}
			}
		}
		// Broj prijavljenih – javno, za neulogovane (vidi samo broj, ne listu)
		var prijaveCount int64
		db.Model(&models.Prijava{}).Where("akcija_id = ?", id).Count(&prijaveCount)
		resp["prijaveCount"] = prijaveCount
		c.JSON(200, resp)
	})

	// Javne rute — profil korisnika (za deljenje linka; bez logina)
	// getKorisnikByIDOrUsername vraća korisnika po id (broj) ili username; vrati nil ako ne nađe
	getKorisnikByIDOrUsername := func(db *gorm.DB, param string) *models.Korisnik {
		param = strings.TrimSpace(param)
		if param == "" {
			return nil
		}
		if id, err := strconv.Atoi(param); err == nil {
			var k models.Korisnik
			if db.First(&k, id).Error == nil {
				return &k
			}
			return nil
		}
		var k models.Korisnik
		if db.Where("username = ?", param).First(&k).Error == nil {
			return &k
		}
		return nil
	}

	// GET /api/korisnici/:id — detalji korisnika javni; :id može biti numerički id ili username
	r.GET("/api/korisnici/:id", func(c *gin.Context) {
		dbAny, _ := c.Get("db")
		db := dbAny.(*gorm.DB)
		param := c.Param("id")
		korisnik := getKorisnikByIDOrUsername(db, param)
		if korisnik == nil {
			c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
		if korisnik.KlubID != nil {
			var klub models.Klubovi
			if db.First(&klub, *korisnik.KlubID).Error == nil {
				korisnik.KlubNaziv = klub.Naziv
				korisnik.KlubLogoURL = klub.LogoURL
			}
		}
		c.JSON(200, korisnik)
	})
	// GET /api/korisnici/:id/statistika — statistika javna; :id može biti numerički id ili username
	r.GET("/api/korisnici/:id/statistika", func(c *gin.Context) {
		dbAny, _ := c.Get("db")
		db := dbAny.(*gorm.DB)
		param := c.Param("id")
		korisnik := getKorisnikByIDOrUsername(db, param)
		if korisnik == nil {
			c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
		c.JSON(200, gin.H{
			"statistika": map[string]interface{}{
				"ukupnoKm":           korisnik.UkupnoKmKorisnik,
				"ukupnoMetaraUspona": korisnik.UkupnoMetaraUsponaKorisnik,
				"brojPopeoSe":        korisnik.BrojPopeoSe,
			},
		})
	})
	// GET /api/korisnici/:id/popeo-se — lista uspešnih akcija javna; :id može biti numerički id ili username
	r.GET("/api/korisnici/:id/popeo-se", func(c *gin.Context) {
		dbAny, _ := c.Get("db")
		db := dbAny.(*gorm.DB)
		param := c.Param("id")
		korisnik := getKorisnikByIDOrUsername(db, param)
		if korisnik == nil {
			c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
		targetID := int(korisnik.ID)
		var prijave []models.Prijava
		if err := db.Where("korisnik_id = ? AND status = ?", targetID, "popeo se").
			Preload("Akcija").
			Find(&prijave).Error; err != nil {
			c.JSON(500, gin.H{"error": "Greška pri čitanju prijava", "details": err.Error()})
			return
		}
		var uspesneAkcije []models.Akcija
		var ukupnoKm float64
		var ukupnoMetaraUspona int
		var brojPopeoSe int
		for _, p := range prijave {
			if p.Akcija.ID != 0 {
				uspesneAkcije = append(uspesneAkcije, p.Akcija)
				ukupnoKm += p.Akcija.UkupnoKmAkcija
				ukupnoMetaraUspona += p.Akcija.UkupnoMetaraUsponaAkcija
				brojPopeoSe++
			}
		}
		c.JSON(200, gin.H{
			"uspesneAkcije": uspesneAkcije,
			"statistika": map[string]interface{}{
				"ukupnoKm":           ukupnoKm,
				"ukupnoMetaraUspona": ukupnoMetaraUspona,
				"brojPopeoSe":        brojPopeoSe,
			},
		})
	})

	// PROTECTED RUTE SVE UNUTAR JEDNOG BLOKA
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(jwtSecret))
	protected.Use(middleware.ClubHoldMiddleware())
	{
		routes.RegisterFinanceRoutes(protected)
		routes.RegisterZadatakRoutes(protected)
		routes.RegisterObavestenjaRoutes(protected)
		routes.RegisterClubRoutes(protected)

		// PATCH /api/klub/logo — admin/sekretar (tog kluba) ili superadmin menja logo effective kluba (multipart "logo")
		protected.PATCH("/klub/logo", func(c *gin.Context) {
			db := c.MustGet("db").(*gorm.DB)
			clubID, ok := helpers.GetEffectiveClubID(c, db)
			if !ok || clubID == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (X-Club-Id) ili niste u klubu"})
				return
			}
			roleVal, _ := c.Get("role")
			role, _ := roleVal.(string)
			if role != "superadmin" && role != "admin" && role != "sekretar" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar kluba mogu da menjaju logo"})
				return
			}
			if role != "superadmin" {
				usernameVal, _ := c.Get("username")
				username, _ := usernameVal.(string)
				var k models.Korisnik
				if err := db.Where("username = ?", username).First(&k).Error; err != nil || k.KlubID == nil || *k.KlubID != clubID {
					c.JSON(http.StatusForbidden, gin.H{"error": "Možete menjati samo logo svog kluba"})
					return
				}
			}
			var klub models.Klubovi
			if err := db.First(&klub, clubID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
				return
			}
			if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
				return
			}
			files := c.Request.MultipartForm.File["logo"]
			if len(files) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite sliku (polje logo)"})
				return
			}
			file := files[0]
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
				PublicID:       fmt.Sprintf("klubovi/klub-logo-%d-%d", clubID, time.Now().Unix()),
				Folder:         helpers.CloudinaryFolderForClub(clubID),
				Transformation: "q_auto:good,f_auto",
			}
			uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u loga: " + err.Error()})
				return
			}
			helpers.AddStorageUsage(db, clubID, file.Size)
			helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), klub.LogoURL)
			klub.LogoURL = uploadResult.SecureURL
			if err := db.Save(&klub).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"klub": klub})
		})

		routes.RegisterSuperadminRoutes(protected)

		// PATCH /api/superadmin/klubovi/:id/logo — upload slike loga kluba (multipart "logo"), Cloudinary
		protected.PATCH("/superadmin/klubovi/:id/logo", func(c *gin.Context) {
			roleVal, _ := c.Get("role")
			if roleVal != "superadmin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo superadmin može menjati logo kluba"})
				return
			}
			idStr := c.Param("id")
			id, err := strconv.ParseUint(idStr, 10, 32)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID kluba"})
				return
			}
			db := c.MustGet("db").(*gorm.DB)
			var klub models.Klubovi
			if err := db.First(&klub, id).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
				return
			}
			if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
				return
			}
			files := c.Request.MultipartForm.File["logo"]
			if len(files) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite sliku (polje logo)"})
				return
			}
			file := files[0]
			if err := helpers.CheckStorageLimit(db, uint(id), file.Size); err != nil {
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
				PublicID:       fmt.Sprintf("klubovi/klub-logo-%d-%d", id, time.Now().Unix()),
				Folder:         helpers.CloudinaryFolderForClub(uint(id)),
				Transformation: "q_auto:good,f_auto",
			}
			uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u loga: " + err.Error()})
				return
			}
			helpers.AddStorageUsage(db, uint(id), file.Size)
			helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), klub.LogoURL)
			klub.LogoURL = uploadResult.SecureURL
			if err := db.Save(&klub).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"klub": klub})
		})

		// GET /api/akcije lista akcija iz baze (filtrirano po effective club)
		protected.GET("/akcije", func(c *gin.Context) {
			dbAny, exists := c.Get("db")
			if !exists {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
				return
			}
			gormDb := dbAny.(*gorm.DB)

			clubID, ok := helpers.GetEffectiveClubID(c, gormDb)
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi.", "aktivne": []models.Akcija{}, "zavrsene": []models.Akcija{}})
				return
			}
			if clubID == 0 {
				c.JSON(http.StatusOK, gin.H{"aktivne": []models.Akcija{}, "zavrsene": []models.Akcija{}})
				return
			}

			var aktivne []models.Akcija
			var zavrsene []models.Akcija
			// Aktivne: klub ili javna (svi vide javne, mogu da se prijave)
			aktivneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND (klub_id = ? OR javna = ?)"
			if err := gormDb.Preload("Klub").Where(aktivneWhere, false, true, clubID, true).Find(&aktivne).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
				return
			}
			// Završene: samo klub koji ju je postavio (javna završena = samo njen klub je vidi)
			zavrseneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND klub_id = ?"
			if err := gormDb.Preload("Klub").Where(zavrseneWhere, true, true, clubID).Find(&zavrsene).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju završenih akcija"})
				return
			}
			for i := range aktivne {
				if aktivne[i].Klub != nil {
					aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
				}
			}
			for i := range zavrsene {
				if zavrsene[i].Klub != nil {
					zavrsene[i].KlubNaziv = zavrsene[i].Klub.Naziv
				}
			}

			c.JSON(http.StatusOK, gin.H{
				"aktivne":  aktivne,
				"zavrsene": zavrsene,
			})
		})

		// POST /api/register kreiranje korisnika (uključujući superadmin)
		// Ako se šalje role=superadmin: dozvoljeno samo kada nema nijednog superadmina (bez auth-a).
		// Za ostale role: obavezan auth (admin ili sekretar), multipart/form-data, role iz forme.
		r.POST("/api/register", func(c *gin.Context) {
			db := c.MustGet("db").(*gorm.DB)

			if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
				return
			}

			username := strings.TrimSpace(c.PostForm("username"))
			password := c.PostForm("password")
			role := strings.TrimSpace(c.PostForm("role"))

			// ——— Kreiranje superadmina (samo ako još nema nijednog, bez auth-a) ———
			if role == "superadmin" {
				if username == "" || password == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezna polja: username i password"})
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
				korisnik := models.Korisnik{
					Username:                         username,
					Password:                         string(hashed),
					FullName:                         fullName,
					ImeRoditelja:                     imeRoditelja,
					Pol:                              pol,
					DatumRodjenja:                    datumRodjenja,
					Drzavljanstvo:                    drzavljanstvo,
					Adresa:                           adresa,
					Telefon:                          telefon,
					Email:                            email,
					BrojLicnogDokumenta:              brojLicnogDokumenta,
					BrojPlaninarskeLegitimacije:      brojPlaninarskeLegitimacije,
					BrojPlaninarskeMarkice:           brojPlaninarskeMarkice,
					DatumUclanjenja:                  datumUclanjenja,
					IzreceneDisciplinskeKazne:        izreceneDisciplinskeKazne,
					IzborUOrganeSportskogUdruzenja:   izborUOrganeSportskogUdruzenja,
					Napomene:                         napomene,
					AvatarURL:                        avatarURL,
					Role:                             "superadmin",
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

			// ——— Ostale uloge: obavezan auth (admin ili sekretar) ———
			authHeader := c.GetHeader("Authorization")
			if authHeader == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
				return
			}
			authHeader = strings.TrimSpace(authHeader)
			if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
				return
			}
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			tokenStr = strings.TrimSpace(tokenStr)
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
			c.Set("username", usernameVal)

			clubID, ok := helpers.GetEffectiveClubID(c, db)
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi pre dodavanja korisnika."})
				return
			}
			if clubID == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nemate dodeljen klub. Samo admin/sekretar u klubu može da dodaje korisnike."})
				return
			}

			if username == "" || password == "" || role == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezna polja: username, password i role"})
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

			// Limiti kluba: max članova i max admina
			if err := helpers.CheckClubLimitsForRegister(db, clubID, role); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			// Hash lozinke
			hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
				return
			}

			// Opciona polja iz modela Korisnik (kao setup/admin)
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

			klubIDPtr := &clubID
			korisnik := models.Korisnik{
				Username:                         username,
				Password:                         string(hashed),
				FullName:                         fullName,
				ImeRoditelja:                     imeRoditelja,
				Pol:                              pol,
				DatumRodjenja:                    datumRodjenja,
				Drzavljanstvo:                    drzavljanstvo,
				Adresa:                           adresa,
				Telefon:                          telefon,
				Email:                            email,
				BrojLicnogDokumenta:              brojLicnogDokumenta,
				BrojPlaninarskeLegitimacije:      brojPlaninarskeLegitimacije,
				BrojPlaninarskeMarkice:           brojPlaninarskeMarkice,
				DatumUclanjenja:                  datumUclanjenja,
				IzreceneDisciplinskeKazne:        izreceneDisciplinskeKazne,
				IzborUOrganeSportskogUdruzenja:   izborUOrganeSportskogUdruzenja,
				Napomene:                         napomene,
				AvatarURL:                        avatarURL,
				Role:                             role,
				KlubID:                           klubIDPtr,
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
		})

		// POST /api/akcije adding new action — admin, superadmin i vodič
		protected.POST("/akcije", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" && role != "superadmin" {
				c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič mogu dodavati akcije"})
				return
			}
			username, _ := c.Get("username")
			db := c.MustGet("db").(*gorm.DB)
			var currentUser models.Korisnik
			if err := db.Where("username = ?", username).First(&currentUser).Error; err != nil {
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
			javna := strings.ToLower(strings.TrimSpace(c.PostForm("javna"))) == "true"

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

			// Nova akcija za klub (AddAction) — uvek u istoriji kluba; ne čitamo iz forme
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
				IsCompleted:              false,
				UIstorijiKluba:           true, // nova akcija za klub = uvek true (AddPastAction ima checkbox)
				Javna:                    javna,
				KlubID:                   &clubID,
				VodicID:                  vodicID,
				DrugiVodicIme:            strings.TrimSpace(drugiVodicIme),
				AddedByID:                currentUser.ID,
			}

			if err := db.Create(&akcija).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri čuvanju akcije"})
				return
			}

			// Obaveštenje svima: nova akcija u kalendaru
			var allUserIDs []uint
			db.Model(&models.Korisnik{}).Pluck("id", &allUserIDs)
			notifications.NotifyUsers(db, allUserIDs, models.ObavestenjeTipAkcija, "Nova akcija u kalendaru", akcija.Naziv, "/akcije/"+strconv.Itoa(int(akcija.ID)))

			// Upload slika na Cloudinary (ako postoji)
			files := form.File["slika"]
			if len(files) > 0 {
				file := files[0]
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

			c.JSON(201, gin.H{
				"message": "Akcija dodata",
				"akcija":  akcija,
			})
		})

		// PATCH /api/akcije/:id — ažuriraj akciju (samo admin, superadmin ili vodič)
		protected.PATCH("/akcije/:id", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" && role != "superadmin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može izmeniti akciju"})
				return
			}

			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
				return
			}

			db := c.MustGet("db").(*gorm.DB)
			var akcija models.Akcija
			if err := db.First(&akcija, id).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
				return
			}

			form, err := c.MultipartForm()
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća forma"})
				return
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
			if rawJavna := c.PostForm("javna"); rawJavna != "" {
				akcija.Javna = strings.ToLower(strings.TrimSpace(rawJavna)) == "true"
			}

			if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
				return
			}
			if !isValidTezina(tezina) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberi težinu od ponuđenih"})
				return
			}

			datum, err := time.Parse("2006-01-02", datumStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Datum mora biti YYYY-MM-DD"})
				return
			}

			kumulativniUsponM, err := strconv.Atoi(kumulativniUsponMStr)
			if err != nil || kumulativniUsponM < 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kumulativni uspon mora biti ceo pozitivan broj (metri)"})
				return
			}

			duzinaStazeKm, err := strconv.ParseFloat(duzinaStazeKmStr, 64)
			if err != nil || duzinaStazeKm < 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Dužina staze mora biti pozitivan broj (km)"})
				return
			}

			if strings.TrimSpace(visinaVrhMStr) != "" {
				visinaVrhM, err := strconv.Atoi(visinaVrhMStr)
				if err != nil || visinaVrhM < 0 {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Visina vrha mora biti ceo pozitivan broj (metri)"})
					return
				}
				akcija.VisinaVrhM = visinaVrhM
			}

			if strings.TrimSpace(zimskiUsponStr) != "" {
				akcija.ZimskiUspon = strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"
			}

			var vodicID uint
			if vodicIDStr != "" {
				if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
					vodicID = uint(vID)
				}
			}

			akcija.Naziv = naziv
			akcija.Planina = planina
			akcija.Vrh = vrh
			akcija.Datum = datum
			akcija.Opis = opis
			akcija.Tezina = tezina
			akcija.UkupnoMetaraUsponaAkcija = kumulativniUsponM
			akcija.UkupnoKmAkcija = duzinaStazeKm
			akcija.VodicID = vodicID
			akcija.DrugiVodicIme = strings.TrimSpace(drugiVodicIme)

			if err := db.Save(&akcija).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju akcije"})
				return
			}

			files := form.File["slika"]
			if len(files) > 0 {
				file := files[0]
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
					PublicID:       fmt.Sprintf("akcije/%d", akcija.ID),
					Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
					Transformation: "q_auto:good,f_auto",
				}

				uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u na Cloudinary: " + err.Error()})
					return
				}
				helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
				helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), akcija.SlikaURL)
				akcija.SlikaURL = uploadResult.SecureURL
				db.Save(&akcija)
			}

			c.JSON(http.StatusOK, gin.H{
				"message": "Akcija uspešno ažurirana",
				"akcija":  akcija,
			})
		})

		// POST /api/akcije/:id/prijavi prijava na akciju
		protected.POST("/akcije/:id/prijavi", func(c *gin.Context) {
			idStr := c.Param("id")
			akcijaID, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
				return
			}

			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			// 1. Pronađi ID korisnika po username-u
			var korisnik models.Korisnik
			if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			// 2. Proveri da li već postoji prijava
			var count int64
			db.Model(&models.Prijava{}).
				Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).
				Count(&count)

			if count > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Već ste prijavljeni za ovu akciju"})
				return
			}

			// 3. Kreiraj prijavu sa KorisnikID (broj)
			prijava := models.Prijava{
				AkcijaID:   uint(akcijaID),
				KorisnikID: korisnik.ID, // ← ovde koristimo ID iz baze
			}

			if err := db.Create(&prijava).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri prijavi", "details": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"message":      "Uspešno ste se prijavili!",
				"akcijaId":     akcijaID,
				"prijavljenAt": prijava.PrijavljenAt,
			})
		})

		// GET /api/akcije/:id/prijave lista prijava za akciju koristimo za ActionDetails page vidi ko je prijavljen i menja status
		// GET /api/akcije/:id/prijave
		protected.GET("/akcije/:id/prijave", func(c *gin.Context) {
			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
				return
			}

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var prijave []models.Prijava
			// BITNO: preload korisnika da imamo username
			if err := db.Preload("Korisnik").Where("akcija_id = ?", id).Find(&prijave).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri čitanju prijava"})
				return
			}

		type PrijavaDTO struct {
			ID           uint      `json:"id"`
			Korisnik     string    `json:"korisnik"`
			FullName     string    `json:"fullName"`
			AvatarURL    string    `json:"avatarUrl,omitempty"`
			PrijavljenAt time.Time `json:"prijavljenAt"`
			Status       string    `json:"status"`
		}

		var out []PrijavaDTO
		for _, p := range prijave {
			fullName := ""
			avatarURL := ""
			if p.Korisnik.ID != 0 {
				fullName = p.Korisnik.FullName
				avatarURL = p.Korisnik.AvatarURL
			}
			out = append(out, PrijavaDTO{
				ID:           p.ID,
				Korisnik:     p.Korisnik.Username,
				FullName:     fullName,
				AvatarURL:    avatarURL,
				PrijavljenAt: p.PrijavljenAt,
				Status:       p.Status,
			})
		}

			c.JSON(200, gin.H{
				"prijave": out,
			})
		})

		// POST /api/akcije/:id/zavrsi oznaci akciju kao zavrsenu, samo admin, superadmin ili vodic
		protected.POST("/akcije/:id/zavrsi", func(c *gin.Context) {
			// Samo admin, superadmin ili vodič
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" && role != "superadmin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može završiti akciju"})
				return
			}

			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
				return
			}

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var akcija models.Akcija
			if err := db.First(&akcija, id).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
				return
			}

			if akcija.IsCompleted {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je već završena"})
				return
			}

			akcija.IsCompleted = true
			if err := db.Save(&akcija).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju akcije"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "Akcija uspešno završena", "akcija": akcija})
		})

		// DELETE /api/akcije/:id — obriši akciju (samo admin, superadmin ili vodič)
		protected.DELETE("/akcije/:id", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" && role != "superadmin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može obrisati akciju"})
				return
			}

			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
				return
			}

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var akcija models.Akcija
			if err := db.First(&akcija, id).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
				return
			}

			// Obriši prvo sve prijave vezane za akciju
			if err := db.Where("akcija_id = ?", id).Delete(&models.Prijava{}).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju prijava"})
				return
			}

			if err := db.Delete(&akcija).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju akcije"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "Akcija uspešno obrisana"})
		})

		// DELETE /api/akcije/:id/prijavi izbrisi prijave na akciju (samo ako je status "prijavljen")
		protected.DELETE("/akcije/:id/prijavi", func(c *gin.Context) {
			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
				return
			}

			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var korisnik models.Korisnik
			if err := db.Where("username = ?", username.(string)).First(&korisnik).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			var prijava models.Prijava
			if err := db.Where("akcija_id = ? AND korisnik_id = ?", id, korisnik.ID).First(&prijava).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Niste bili prijavljeni na ovu akciju"})
				return
			}

			// Ne dozvoli otkazivanje ako admin je već označio "popeo se" ili "nije uspeo"
			if prijava.Status != "prijavljen" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Ne možete otkazati prijavu nakon što vam je admin potvrdio uspeh ili neuspeh"})
				return
			}

			if err := db.Delete(&prijava).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "Uspešno ste otkazali prijavu"})
		})

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
			if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
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
			if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
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

			// Username: ako je poslat i različit od trenutnog, provera jedinstvenosti
			newUsername := post("username")
			if newUsername == "" {
				newUsername = korisnik.Username
			}
			if newUsername != korisnik.Username {
				var existing models.Korisnik
				if err := db.Where("username = ?", newUsername).First(&existing).Error; err == nil {
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
				"username":                     newUsername,
				"full_name":                    fullName,
				"ime_roditelja":                imeRoditelja,
				"pol":                          pol,
				"drzavljanstvo":                drzavljanstvo,
				"adresa":                       adresa,
				"telefon":                      telefon,
				"email":                        email,
				"broj_licnog_dokumenta":        brojLicnogDokumenta,
				"broj_planinarske_legitimacije": brojPlaninarskeLegitimacije,
				"broj_planinarske_markice":     brojPlaninarskeMarkice,
				"datum_rodjenja":               datumRodjenja,
				"datum_uclanjenja":             datumUclanjenja,
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
			// Ako je promenjeno korisničko ime, vrati novi JWT da klijent može da ga sačuva (inače sledeći zahtev bi tražio starim username-om)
			if newUsername != username.(string) {
				claims := jwt.MapClaims{
					"username": korisnik.Username,
					"role":     korisnik.Role,
					"exp":      time.Now().Add(time.Hour * 24).Unix(),
				}
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				tokenString, err := token.SignedString(jwtSecret)
				if err == nil {
					resp["token"] = tokenString
					resp["role"] = korisnik.Role
					resp["user"] = gin.H{"username": korisnik.Username, "fullName": korisnik.FullName}
				}
			}
			c.JSON(200, resp)
		})

		// PATCH /api/me/cover-position — samo pozicija cover slike (JSON: { "coverPositionY": 0–1 })
		protected.PATCH("/me/cover-position", func(c *gin.Context) {
			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}
			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var korisnik models.Korisnik
			if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			var body struct {
				CoverPositionY *float64 `json:"coverPositionY"`
			}
			if err := c.ShouldBindJSON(&body); err != nil || body.CoverPositionY == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Očekuje se JSON: { coverPositionY: number (0–1) }"})
				return
			}
			pos := *body.CoverPositionY
			if pos < 0 {
				pos = 0
			}
			if pos > 1 {
				pos = 1
			}
			if err := db.Model(&korisnik).Update("cover_position_y", pos).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju pozicije"})
				return
			}
			c.JSON(200, gin.H{"message": "Pozicija sačuvana", "coverPositionY": pos})
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
			if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
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
			var body struct {
				Role                           string `json:"role"`
				IzreceneDisciplinskeKazne     string `json:"izreceneDisciplinskeKazne"`
				IzborUOrganeSportskogUdruzenja string `json:"izborUOrganeSportskogUdruzenja"`
				Napomene                      string `json:"napomene"`
				NewPassword                   string `json:"newPassword"`
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
				"role":                              body.Role,
				"izrecene_disciplinske_kazne":       body.IzreceneDisciplinskeKazne,
				"izbor_u_organe_sportskog_udruzenja": body.IzborUOrganeSportskogUdruzenja,
				"napomene":                          body.Napomene,
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

			// Ne dozvoli brisanje ako je korisnik uneo transakcije (korisnik_id je obavezan)
			var transCount int64
			if err := db.Model(&models.Transakcija{}).Where("korisnik_id = ?", id).Count(&transCount).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri transakcija"})
				return
			}
			if transCount > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": "Ne možete obrisati korisnika koji ima unete transakcije. Prvo preuredite ili obrišite te transakcije."})
				return
			}

			// Čišćenje povezanih podataka
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

			clubID, ok := helpers.GetEffectiveClubID(c, db)
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi.", "korisnici": []models.Korisnik{}})
				return
			}
			if clubID == 0 {
				c.JSON(200, gin.H{"korisnici": []models.Korisnik{}})
				return
			}

			var korisnici []models.Korisnik
			if err := db.Preload("Klub").Where("klub_id = ?", clubID).Find(&korisnici).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri učitavanju korisnika"})
				return
			}
			for i := range korisnici {
				if korisnici[i].Klub != nil {
					korisnici[i].KlubNaziv = korisnici[i].Klub.Naziv
					korisnici[i].KlubLogoURL = korisnici[i].Klub.LogoURL
				}
			}
			c.JSON(200, gin.H{"korisnici": korisnici})
		})


		// POST /api/korisnici/:id/dodaj-proslu-akciju – admin/superadmin/vodič dodaje novu prošlu akciju (npr. sa drugog društva) i upisuje korisnika kao "popeo se"
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
			if err := db.Where("username = ?", username).First(&currentUser).Error; err != nil {
				c.JSON(500, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			var korisnik models.Korisnik
			if err := db.First(&korisnik, korisnikID).Error; err != nil {
				c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
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

			prijava := models.Prijava{
				AkcijaID:   akcija.ID,
				KorisnikID: uint(korisnikID),
				Status:     "popeo se",
			}
			if err := db.Create(&prijava).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri dodavanju prijave"})
				return
			}

			korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
			korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
			korisnik.BrojPopeoSe += 1
			if err := db.Save(&korisnik).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
				return
			}

			c.JSON(200, gin.H{"message": "Prošla akcija dodata", "korisnikId": korisnik.ID})
		})

		// GET /api/moje-popeo-se lista akcija na koje se korisnik popeo, za profil page
		protected.GET("/moje-popeo-se", func(c *gin.Context) {
			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			// 1. Pronađi ID ulogovanog korisnika po username-u
			var korisnik models.Korisnik
			if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Korisnik nije pronađen", "details": err.Error()})
				return
			}

			// 2. Dohvati prijave po korisnik_id (broj)
			var prijave []models.Prijava
			err := db.Where("korisnik_id = ? AND status = ?", korisnik.ID, "popeo se").
				Preload("Akcija").
				Find(&prijave).Error

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijava", "details": err.Error()})
				return
			}

			// 3. Pripremi akcije i statistiku
			var uspesneAkcije []models.Akcija
			var ukupnoKm float64
			var ukupnoMetaraUspona int
			var brojPopeoSe int

			for _, p := range prijave {
				if p.Akcija.ID != 0 {
					uspesneAkcije = append(uspesneAkcije, p.Akcija)
					ukupnoKm += p.Akcija.UkupnoKmAkcija
					ukupnoMetaraUspona += p.Akcija.UkupnoMetaraUsponaAkcija
					brojPopeoSe++
				}
			}

			c.JSON(http.StatusOK, gin.H{
				"uspesneAkcije": uspesneAkcije,
				"statistika": map[string]interface{}{
					"ukupnoKm":           ukupnoKm,
					"ukupnoMetaraUspona": ukupnoMetaraUspona,
					"brojPopeoSe":        brojPopeoSe,
				},
			})
		})

		// POST /api/prijave/:id/status update status of prijava (admin, superadmin ili vodič)
		protected.POST("/prijave/:id/status", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" && role != "superadmin" {
				c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič može menjati status"})
				return
			}

			idStr := c.Param("id")
			prijavaID, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(400, gin.H{"error": "Nevažeći ID prijave"})
				return
			}

			var req struct {
				Status string `json:"status" binding:"required"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(400, gin.H{"error": "Nevažeći status"})
				return
			}

			log.Printf("Primljen status (raw): '%q'", req.Status) // %q pokazuje skrivene karaktere
			log.Printf("Dužina stringa: %d", len(req.Status))

			validStatuses := map[string]bool{
				"prijavljen": true,
				"popeo se":   true,
				"nije uspeo": true,
				"otkazano":   true,
			}
			if !validStatuses[req.Status] {
				c.JSON(400, gin.H{"error": "Nevažeći status"})
				return
			}

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var prijava models.Prijava
			if err := db.Preload("Akcija").First(&prijava, prijavaID).Error; err != nil {
				c.JSON(404, gin.H{"error": "Prijava nije pronađena"})
				return
			}

			// Ako menjamo status na 'popeo se' dodaj statistiku korisniku
			if req.Status == "popeo se" && prijava.Status != "popeo se" {
				var korisnik models.Korisnik
				// sada koristimo KorisnikID iz prijave umesto starog username polja
				if err := db.First(&korisnik, prijava.KorisnikID).Error; err != nil {
					c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
					return
				}

				korisnik.UkupnoKmKorisnik += prijava.Akcija.UkupnoKmAkcija
				korisnik.UkupnoMetaraUsponaKorisnik += prijava.Akcija.UkupnoMetaraUsponaAkcija
				korisnik.BrojPopeoSe += 1

				if err := db.Save(&korisnik).Error; err != nil {
					c.JSON(500, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
					return
				}
			}

			prijava.Status = req.Status
			if err := db.Save(&prijava).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri ažuriranju statusa"})
				return
			}

			c.JSON(200, gin.H{
				"message": "Status ažuriran",
				"prijava": prijava,
			})
		})

		// GET /api/moje-prijave list of IDs of akcije that user is signed up for, for quick check on frontend for ACTIONS PAGE
		// prijavljeneAkcije = sve akcije gde je korisnik prijavljen (bilo koji status)
		// otkaziveAkcije = samo gde je status "prijavljen" (korisnik može otkazati)
		protected.GET("/moje-prijave", func(c *gin.Context) {
			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}

			dbAny, exists := c.Get("db")
			if !exists {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
				return
			}
			db := dbAny.(*gorm.DB)

			// Pronađi korisnika po username-u da dobijemo njegov ID
			var korisnik models.Korisnik
			if err := db.Where("username = ?", username.(string)).First(&korisnik).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			var prijavljene []uint
			db.Model(&models.Prijava{}).
				Where("korisnik_id = ?", korisnik.ID).
				Pluck("akcija_id", &prijavljene)

			var otkazive []uint
			db.Model(&models.Prijava{}).
				Where("korisnik_id = ? AND status = ?", korisnik.ID, "prijavljen").
				Pluck("akcija_id", &otkazive)

			c.JSON(http.StatusOK, gin.H{
				"prijavljeneAkcije": prijavljene,
				"otkaziveAkcije":    otkazive,
			})
		})
	}

	r.Static("/uploads", "./uploads")

	// Dnevni job: brisanje zamenjenih slika iz Cloudinary nakon 60 dana (praksa velikih kompanija)
	go jobs.RunCloudinaryPendingDeletesJob(db)

	r.Run(":8080")
}
