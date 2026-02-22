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
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
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

	// CORS middlewareF
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
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
	r.POST("/login", func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}

		var role string
		var fullName string

		if req.Username == "admin" && req.Password == "admin123" {
			role = "admin"
			fullName = "Admin Adri"
		} else if req.Username == "clan1" && req.Password == "clan123" {
			role = "clan"
			fullName = "Pera Perić"
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		claims := jwt.MapClaims{
			"username": req.Username,
			"role":     role,
			"exp":      time.Now().Add(time.Hour * 24).Unix(),
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, LoginResponse{
			Token: tokenString,
			Role:  role,
			User: struct {
				Username string `json:"username"`
				FullName string `json:"fullName"`
			}{
				Username: req.Username,
				FullName: fullName,
			},
		})
	})

	// PROTECTED RUTE SVE UNUTAR JEDNOG BLOKA
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware())
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

		// POST /api/akcije adding new action, only for admin
		protected.POST("/akcije", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" {
				c.JSON(403, gin.H{"error": "Samo admin može dodavati akcije"})
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

			akcija := models.Akcija{
				Naziv:             naziv,
				Vrh:               vrh,
				Datum:             datum,
				Opis:              opis,
				Tezina:            tezina,
				KumulativniUsponM: kumulativniUsponM,
				DuzinaStazeKm:     duzinaStazeKm,
				SlikaURL:          "",
				IsCompleted:       false,
			}

			db := c.MustGet("db").(*gorm.DB)

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

			var count int64
			db.Model(&models.Prijava{}).
				Where("akcija_id = ? AND korisnik = ?", id, korisnik).
				Count(&count)

			if count > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Već ste prijavljeni za ovu akciju"})
				return
			}

			prijava := models.Prijava{
				AkcijaID: uint(id),
				Korisnik: korisnik,
			}

			if err := db.Create(&prijava).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri prijavi"})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"message":      "Uspešno ste se prijavili!",
				"akcijaId":     id,
				"prijavljenAt": prijava.PrijavljenAt,
			})
		})

		// GET /api/akcije/:id/prijave lista prijava za akciju koristimo za ActionDetails page vidi ko je prijavljen i menja status
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
			if err := db.Where("akcija_id = ?", id).Find(&prijave).Error; err != nil {
				c.JSON(500, gin.H{"error": "Greška pri čitanju prijava"})
				return
			}

			c.JSON(200, gin.H{
				"prijave": prijave,
			})
		})

		// POST /api/akcije/:id/zavrsi oznaci akciju kao zavrsenu, samo admin ili vodic
		protected.POST("/akcije/:id/zavrsi", func(c *gin.Context) {
			// Samo admin ili vodič
			role, _ := c.Get("role")
			if role != "admin" && role != "vodjac" {
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

		// GET /api/moje-akcije lista akcija na koje je korisnik prijavljen sa detaljima za profil page
		protected.GET("/moje-akcije-profil", func(c *gin.Context) {
			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}
			korisnik := username.(string)

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var mojePrijave []struct {
				AkcijaID     uint
				Naziv        string
				Vrh          string
				Datum        time.Time
				Opis         string
				Tezina       string
				PrijavljenAt time.Time
			}

			db.Table("prijave").
				Joins("JOIN akcije ON prijave.akcija_id = akcije.id").
				Where("prijave.korisnik = ?", korisnik).
				Select("prijave.akcija_id, akcije.naziv, akcije.vrh, akcije.datum, akcije.opis, akcije.tezina, prijave.prijavljen_at").
				Scan(&mojePrijave)

			c.JSON(http.StatusOK, gin.H{"prijave": mojePrijave})
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

		// GET /api/akcije/:id detalji o akciji
		protected.GET("/akcije/:id", func(c *gin.Context) {
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

			c.JSON(200, akcija)
		})

		// GET /api/moje-popeo-se lista akcija na koje se korisnik popeo, za profil page
		protected.GET("/moje-popeo-se", func(c *gin.Context) {
			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}
			korisnik := username.(string)

			dbAny, _ := c.Get("db")
			db := dbAny.(*gorm.DB)

			var prijave []models.Prijava
			if err := db.Where("korisnik = ? AND status = ?", korisnik, "popeo se").Preload("Akcija").Find(&prijave).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju uspešnih akcija"})
				return
			}

			var uspesneAkcije []models.Akcija
			for _, p := range prijave {
				uspesneAkcije = append(uspesneAkcije, p.Akcija)
			}

			c.JSON(http.StatusOK, gin.H{
				"uspesneAkcije": uspesneAkcije,
			})
		})

		// POST /api/prijave/:id/status update status of prijava
		protected.POST("/prijave/:id/status", func(c *gin.Context) {
			role, _ := c.Get("role")
			if role != "admin" && role != "vodjac" {
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

			// Ako menjamo status na 'popeo se' – dodaj statistiku korisniku
			if req.Status == "popeo se" && prijava.Status != "popeo se" {
				var korisnik models.Korisnik
				if err := db.Where("username = ?", prijava.Korisnik).First(&korisnik).Error; err != nil {
					c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
					return
				}

				korisnik.UkupnoKm += prijava.Akcija.DuzinaStazeKm
				korisnik.UkupnoMetaraUspona += prijava.Akcija.KumulativniUsponM
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

		// GET /api/mojeprijave list of IDs of ackije that user is signed up for, for quick check on frontend for ACTIONS PAGE
		protected.GET("/moje-prijave", func(c *gin.Context) {
			username, exists := c.Get("username")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
				return
			}
			korisnik := username.(string)

			dbAny, exists := c.Get("db")
			if !exists {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
				return
			}
			db := dbAny.(*gorm.DB)

			var prijavljene []uint
			db.Model(&models.Prijava{}).
				Where("korisnik = ?", korisnik).
				Pluck("akcija_id", &prijavljene)

			c.JSON(http.StatusOK, gin.H{"prijavljeneAkcije": prijavljene})
		})
	}

	r.Static("/uploads", "./uploads")
	r.Run(":8080")
}
