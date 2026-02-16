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
	r := gin.Default() //this is almost the same like creating routes in gorilla mux

	//connect to database
	dsn := "host=localhost user=postgres password=novatajna123 dbname=adri_sentinel port=5432 sslmode=disable TimeZone=Europe/Belgrade"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Ne mogu da se povežem sa bazom:", err)
	}

	fmt.Println("Uspješno povezan sa bazom!")
	//inject db into context for handlers to use
	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	})

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"}, // frontend URL
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

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

		//Database sumilation hardcoded users
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

		// craeat jwt token
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

	//protected routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware())
	{

		///ackija ruta handler
		protected.GET("/akcije", func(c *gin.Context) {
			db, exists := c.Get("db")
			if !exists {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
				return
			}

			gormDb := db.(*gorm.DB)

			var akcije []models.Akcija
			result := gormDb.Find(&akcije)
			if result.Error != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch akcije"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"akcije": akcije})
		})

		//POST /api/akcije/:id/prijavi
		var prijave = make(map[int][]string)

		protected.POST("/akcije/:id/prijavi", func(c *gin.Context) {
			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action ID"})
				return
			}

			//extract username from context
			username, exists := c.Get("username") //middleware je stavio usera ovde
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
				return
			}

			userNameStr, ok := username.(string)
			if !ok {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user data"})
				return
			}

			//check if user already applied for this action
			if _, ok := prijave[id]; !ok {
				prijave[id] = []string{}
			}

			for _, u := range prijave[id] {
				if u == userNameStr {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Već ste prijavljeni za ovu akciju"})
					return
				}
			}

			//add user
			prijave[id] = append(prijave[id], userNameStr)

			c.JSON(http.StatusOK, gin.H{
				"message":     "Uspešno ste se prijavili za akciju!",
				"akcijaId":    id,
				"prijavljeni": len(prijave[id]),
			})
		})

	}

	r.Run(":8080")
}
