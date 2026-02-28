package main

import (
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

func main() {
	r := gin.Default()
	err := godotenv.Load()
	if err != nil {
		log.Println("GREŠKA: .env fajl NIJE UČITAN! Razlog:", err)
	} else {
		log.Println("OK: .env fajl je učitan")
		log.Println("DB_PASSWORD iz env:", os.Getenv("DB_PASSWORD")) // vidiš li lozinku?
	}

	
	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:5173"
	}
	var origins []string
	for _, o := range strings.Split(corsOrigins, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}
	if len(origins) == 0 {
		origins = []string{"http://localhost:5173"}
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
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
	)
	if err != nil {
		log.Fatal("Greška pri automigraciji tabela:", err)
	}
	log.Println("Tabele 'akcije' i 'prijave' su migrirane")

	// Inject db u Gin context
	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	})

	// Public rute

	// GET /api/setup/status proveri da li već postoje korisnici u bazi
	r.GET("/api/setup/status", func(c *gin.Context) {
		var count int64
		if err := db.Model(&models.Korisnik{}).Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri stanja setup-a"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"hasUsers": count > 0,
		})
	})

	// POST /api/setup/admin (RegisterAdmin) — kreiranje prvog admina prema modelu Korisnik
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

		// Samo ako nema korisnika — prvi korisnik mora biti admin
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
				PublicID: fmt.Sprintf("avatari/setup-%s-%d", username, time.Now().Unix()),
				Folder:   "adri-sentinel",
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

	// Javna ruta — detalji akcije (za deljenje linka; vraća i vodiča i ko je dodao)
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
			"id": akcija.ID, "naziv": akcija.Naziv, "vrh": akcija.Vrh, "datum": akcija.Datum,
			"opis": akcija.Opis, "tezina": akcija.Tezina, "slikaUrl": akcija.SlikaURL,
			"createdAt": akcija.CreatedAt, "updatedAt": akcija.UpdatedAt,
			"isCompleted": akcija.IsCompleted, "kumulativniUsponM": akcija.UkupnoMetaraUsponaAkcija,
			"duzinaStazeKm": akcija.UkupnoKmAkcija, "vodicId": akcija.VodicID,
			"drugiVodicIme": akcija.DrugiVodicIme, "addedById": akcija.AddedByID,
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
		c.JSON(200, resp)
	})

	// PROTECTED RUTE SVE UNUTAR JEDNOG BLOKA
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(jwtSecret))
	{
		// GET /api/akcije lista akcija iz baze
		protected.GET("/akcije", func(c *gin.Context) {
			dbAny, exists := c.Get("db")
			if !exists {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
				return
			}

			gormDb := dbAny.(*gorm.DB)

			var aktivne []models.Akcija
			var zavrsene []models.Akcija

			// Aktivne akcije (is_completed = false)
			if err := gormDb.Where("is_completed = ?", false).Find(&aktivne).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
				return
			}

			// Završene akcije (is_completed = true)
			if err := gormDb.Where("is_completed = ?", true).Find(&zavrsene).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju završenih akcija"})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"aktivne":  aktivne,
				"zavrsene": zavrsene,
			})
		})

		// POST /api/register registracija novog korisnika (samo admin ili sekretar)
		r.POST("/api/register", middleware.AuthMiddleware(jwtSecret), func(c *gin.Context) {
			// Proveri da li je korisnik admin ili sekretar
			role, exists := c.Get("role")
			if !exists || (role != "admin" && role != "sekretar") {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu da kreiraju nove korisnike"})
				return
			}

			var req struct {
				Username string `json:"username" binding:"required"`
				Password string `json:"password" binding:"required,min=8"`
				FullName string `json:"fullName" binding:"required"`
				Email    string `json:"email" binding:"required,email"`
				Adresa   string `json:"adresa" binding:"required"`
				Telefon  string `json:"telefon" binding:"required"`
				Role     string `json:"role" binding:"required,oneof=admin clan vodic blagajnik sekretar menadzer-opreme"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			// Hash lozinke
			hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
				return
			}

			korisnik := models.Korisnik{
				Username: req.Username,
				Password: string(hashed),
				FullName: req.FullName,
				Email:    req.Email,
				Adresa:   req.Adresa,
				Telefon:  req.Telefon,
				Role:     req.Role,
			}

			if err := db.Create(&korisnik).Error; err != nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username/email već postoji"})
				return
			}

			c.JSON(http.StatusCreated, gin.H{
				"message": "Korisnik uspešno kreiran",
				"role":    req.Role,
			})
		})

		// POST /api/akcije adding new action, only for admin
		protected.POST("/akcije", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" {
				c.JSON(403, gin.H{"error": "Samo admin može dodavati akcije"})
				return
			}
			username, _ := c.Get("username")
			db := c.MustGet("db").(*gorm.DB)
			var currentUser models.Korisnik
			if err := db.Where("username = ?", username).First(&currentUser).Error; err != nil {
				c.JSON(500, gin.H{"error": "Korisnik nije pronađen"})
				return
			}

			form, err := c.MultipartForm()
			if err != nil {
				c.JSON(400, gin.H{"error": "Nevažeća forma"})
				return
			}

			naziv := c.PostForm("naziv")
			vrh := c.PostForm("vrh")
			datumStr := c.PostForm("datum")
			opis := c.PostForm("opis")
			tezina := c.PostForm("tezina")
			kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
			duzinaStazeKmStr := c.PostForm("duzinaStazeKm")
			vodicIDStr := c.PostForm("vodic_id")
			drugiVodicIme := c.PostForm("drugi_vodic_ime")

			if naziv == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
				c.JSON(400, gin.H{"error": "Sva polja su obavezna osim opisa i slike (uspon i dužina staze su obavezni)"})
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

			var vodicID uint
			if vodicIDStr != "" {
				if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
					vodicID = uint(vID)
				}
			}

			akcija := models.Akcija{
				Naziv:                    naziv,
				Vrh:                      vrh,
				Datum:                    datum,
				Opis:                     opis,
				Tezina:                   tezina,
				UkupnoMetaraUsponaAkcija: kumulativniUsponM,
				UkupnoKmAkcija:           duzinaStazeKm,
				SlikaURL:                 "",
				IsCompleted:              false,
				VodicID:                  vodicID,
				DrugiVodicIme:            strings.TrimSpace(drugiVodicIme),
				AddedByID:                currentUser.ID,
			}

			if err := db.Create(&akcija).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri čuvanju akcije"})
				return
			}

			// Upload slika na Cloudinary (ako postoji)
			files := form.File["slika"]
			if len(files) > 0 {
				file := files[0]

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
					PublicID: fmt.Sprintf("akcije/%d", akcija.ID),
					Folder:   "adri-sentinel",
				}

				uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
				if err != nil {
					c.JSON(500, gin.H{"error": "Greška pri upload-u na Cloudinary: " + err.Error()})
					return
				}

				akcija.SlikaURL = uploadResult.SecureURL
				db.Save(&akcija)
			}

			c.JSON(201, gin.H{
				"message": "Akcija dodata",
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

			// DTO koji frontend očekuje
			type PrijavaDTO struct {
				ID           uint      `json:"id"`
				Korisnik     string    `json:"korisnik"`
				PrijavljenAt time.Time `json:"prijavljenAt"`
				Status       string    `json:"status"`
			}

			var out []PrijavaDTO
			for _, p := range prijave {
				out = append(out, PrijavaDTO{
					ID:           p.ID,
					Korisnik:     p.Korisnik.Username,
					PrijavljenAt: p.PrijavljenAt,
					Status:       p.Status,
				})
			}

			c.JSON(200, gin.H{
				"prijave": out,
			})
		})

		// POST /api/akcije/:id/zavrsi oznaci akciju kao zavrsenu, samo admin ili vodic
		protected.POST("/akcije/:id/zavrsi", func(c *gin.Context) {
			// Samo admin ili vodič
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič može završiti akciju"})
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

		// DELETE /api/akcije/:id/prijavi izbrisi prijave na akciju
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
			korisnik := username.(string)

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			// Nađi i obriši prijavu
			result := db.Where("akcija_id = ? AND korisnik = ?", id, korisnik).Delete(&models.Prijava{})
			if result.Error != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju"})
				return
			}
			if result.RowsAffected == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Niste bili prijavljeni na ovu akciju"})
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
			isAdmin := roleVal == "admin"

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
					PublicID: fmt.Sprintf("avatari/%s-%d", newUsername, time.Now().Unix()),
					Folder:   "adri-sentinel",
				}

				uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u slike: " + err.Error()})
					return
				}
				korisnik.AvatarURL = uploadResult.SecureURL
			}

			// Ažuriraj dozvoljena polja. Role, disciplinske kazne, izbor u organe, napomene — samo admin (PATCH /korisnici/:id)
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
			// Samo admin može menjati disciplinske kazne, izbor u organe, napomene
			if isAdmin {
				updates["izrecene_disciplinske_kazne"] = izreceneDisciplinskeKazne
				updates["izbor_u_organe_sportskog_udruzenja"] = izborUOrganeSportskogUdruzenja
				updates["napomene"] = napomene
			}
			if korisnik.AvatarURL != "" {
				updates["avatar_url"] = korisnik.AvatarURL
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

		// PATCH /api/korisnici/:id — admin ažurira korisnika (samo role, disciplinske kazne, izbor u organe, napomene). Lozinka se ne vidi ni ne menja.
		protected.PATCH("/korisnici/:id", func(c *gin.Context) {
			roleVal, _ := c.Get("role")
			if roleVal != "admin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin može menjati korisnika"})
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
			}
			_ = c.ShouldBindJSON(&body) // opciono
			if body.Role == "" {
				body.Role = korisnik.Role
			}
			if body.Role != "" && body.Role != korisnik.Role {
				validRoles := map[string]bool{"admin": true, "clan": true, "vodic": true, "blagajnik": true, "sekretar": true, "menadzer-opreme": true}
				if !validRoles[body.Role] {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća uloga"})
					return
				}
			}
			updates := map[string]interface{}{
				"role":                              body.Role,
				"izrecene_disciplinske_kazne":       body.IzreceneDisciplinskeKazne,
				"izbor_u_organe_sportskog_udruzenja": body.IzborUOrganeSportskogUdruzenja,
				"napomene":                          body.Napomene,
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

		// GET /api/korisnici/:id detalji o korisniku
		protected.GET("/korisnici/:id", func(c *gin.Context) {
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

			c.JSON(200, korisnik)
		})

		// GET /api/korisnici list of all users
		protected.GET("/korisnici", func(c *gin.Context) {
			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var korisnici []models.Korisnik
			if err := db.Find(&korisnici).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri učitavanju korisnika"})
				return
			}

			c.JSON(200, gin.H{"korisnici": korisnici})
		})

		// GET /api/akcije/:id — detalji su javni (ruta registrovana iznad, van protected)
		// GET /api/korisnici/:id/popeo-se lista akcija koje je korisnik popeo se,
		// i statistika ukupno km, metara uspona i broj popeo se.
		// Ovaj endpoint je vidljiv svim ulogovanim korisnicima (nema provere da li gledaš svoj ili tuđ profil).
		protected.GET("/korisnici/:id/popeo-se", func(c *gin.Context) {
			// 1. ID korisnika čiji profil gledamo
			idStr := c.Param("id")
			targetID, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID korisnika"})
				return
			}

			// 2. Baza
			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			// 3. Dohvati prijave za target korisnika po korisnik_id (broj!)
			var prijave []models.Prijava
			err = db.Where("korisnik_id = ? AND status = ?", targetID, "popeo se").
				Preload("Akcija").
				Find(&prijave).Error

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijava", "details": err.Error()})
				return
			}

			// 4. Pripremi listu akcija i statistiku
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

		// GET /api/korisnici/:id/statistika statistika korisnika za user profil page
		protected.GET("/korisnici/:id/statistika", func(c *gin.Context) {
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

			c.JSON(200, gin.H{
				"statistika": map[string]interface{}{
					"ukupnoKm":           korisnik.UkupnoKmKorisnik,
					"ukupnoMetaraUspona": korisnik.UkupnoMetaraUsponaKorisnik,
					"brojPopeoSe":        korisnik.BrojPopeoSe,
				},
			})
		})

		// POST /api/prijave/:id/status update status of prijava
		protected.POST("/prijave/:id/status", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" && role != "vodic" {
				c.JSON(403, gin.H{"error": "Samo admin ili vodič može menjati status"})
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

			c.JSON(http.StatusOK, gin.H{"prijavljeneAkcije": prijavljene})
		})
	}

	r.Static("/uploads", "./uploads")
	r.Run(":8080")
}
