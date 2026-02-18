package main

import (
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

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

	// CORS middleware
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
	}

	fmt.Println("Uspješno povezan sa bazom!")

	// AutoMigrate kreira ili ažurira tabele
	err = db.AutoMigrate(
		&models.Akcija{},
		&models.Prijava{},
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

			var akcije []models.Akcija
			result := gormDb.Find(&akcije)
			if result.Error != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju akcija"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"akcije": akcije})
		})

		// POST /api/akcije adding new action, only for admin
		protected.POST("/akcije", func(c *gin.Context) {
			// check role
			role, exists := c.Get("role")
			if !exists || role.(string) != "admin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin može da dodaje akcije"})
				return
			}

			// parse multipart form (text + file) max 32MB
			if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format forme"})
				return
			}

			// extract form values
			naziv := c.PostForm("naziv")
			vrh := c.PostForm("vrh")
			datumStr := c.PostForm("datum")
			opis := c.PostForm("opis")
			tezina := c.PostForm("tezina")

			// check required fields
			if naziv == "" || vrh == "" || datumStr == "" || tezina == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nedostaju obavezna polja"})
				return
			}

			// parse date we expect either "2024-07-01T10:00:00Z" or "2024-07-01"
			datum, err := time.Parse("2006-01-02T15:04:05Z", datumStr)
			if err != nil {
				datum, err = time.Parse("2006-01-02", datumStr)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format datuma"})
					return
				}
			}

			//QlyxC5QeXyoK3F4MrgNsYYdylV8

			// photo upload handling
			slikaURL := ""
			file, header, err := c.Request.FormFile("slika") // "slika" je ime polja iz FormData
			if err == nil {
				// create uploads directory if it doesn't exist
				uploadDir := "uploads/akcije"
				if err := os.MkdirAll(uploadDir, 0755); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju foldera"})
					return
				}

				// generate unique filename to avoid collisions
				filename := fmt.Sprintf("%d-%s", time.Now().Unix(), header.Filename)
				filepath := uploadDir + "/" + filename

				// save file to disk
				out, err := os.Create(filepath)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju slike"})
					return
				}
				defer out.Close()

				if _, err := io.Copy(out, file); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju slike"})
					return
				}

				// URL which can be used to access the image, assuming static files are served from root
				slikaURL = "/" + filepath
			}

			// create object to save in database
			novaAkcija := models.Akcija{
				Naziv:    naziv,
				Vrh:      vrh,
				Datum:    datum,
				Opis:     opis,
				Tezina:   tezina,
				SlikaURL: slikaURL,
			}

			// db write
			dbAny, exists := c.Get("db")
			if !exists {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
				return
			}
			db := dbAny.(*gorm.DB)

			if err := db.Create(&novaAkcija).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju akcije"})
				return
			}

			// return success response with created akcija
			c.JSON(http.StatusOK, gin.H{
				"message": "Akcija uspešno dodata!",
				"akcija":  novaAkcija,
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
