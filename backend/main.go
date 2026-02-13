package main

import (
	"beleg-app/backend/middleware"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
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
	r := gin.Default() //this is almost the same like creating routes in gorilla mu

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
		protected.GET("/test", func(c *gin.Context) {
			username, _ := c.Get("username")
			role, _ := c.Get("role")
			c.JSON(http.StatusOK, gin.H{
				"message":  "Protected route OK",
				"username": username,
				"role":     role,
			})
		})

		///ackija ruta handler
		protected.GET("/akcije", func(c *gin.Context) {
			// Simulirana lista akcija (kasnije iz baze)
			akcije := []map[string]interface{}{
				{
					"id":    1,
					"naziv": "Uspon na Rtanj",
					"vrh":   "Rtanj (1565m)",
					"datum": "2026-03-15",
					"opis":  "Tehnički uspon sa prelepim pogledom na Dunav.",
				},
				{
					"id":    2,
					"naziv": "Tara zimski uspon",
					"vrh":   "Zvijezda (1544m)",
					"datum": "2026-02-28",
					"opis":  "Zimska tura sa krpljama, mogućnost noćenja u planinarskom domu.",
				},
				{
					"id":    3,
					"naziv": "Kopaonik prolećni treking",
					"vrh":   "Pančićev vrh (2017m)",
					"datum": "2026-04-20",
					"opis":  "Lagana tura sa puno cvijeća i pogledom na celu Srbiju.",
				},
			}

			c.JSON(http.StatusOK, gin.H{
				"akcije": akcije,
			})
		})
	}

	r.Run(":8080")
}
