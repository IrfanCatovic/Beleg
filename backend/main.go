package main

import (
	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var jwtSecret = []byte("super-secret-key-adri-sentinel-9876543210")

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

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Konekcija na bazu
	dsn := "host=localhost user=postgres password=novatajna123 dbname=adri_sentinel port=5432 sslmode=disable TimeZone=Europe/Belgrade"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Ne mogu da se povežem sa bazom:", err)
	}

	fmt.Println("Uspješno povezan sa bazom!")

	// AutoMigrate – kreira ili ažurira tabele
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
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Pong from Adri Sentinel backend!"})
	})

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

	// PROTECTED RUTE – SVE UNUTAR JEDNOG BLOKA
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware())
	{
		// GET /api/akcije – lista akcija iz baze
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

		// POST /api/akcije/:id/prijavi – prijava na akciju
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

		// GET /api/moje-prijave – lista ID-ova akcija na koje je korisnik prijavljen
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

	// OVO MORA BITI NA KRAJU – NIKAKO ISPOD!
	r.Run(":8080")
}
