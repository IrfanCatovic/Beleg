package main

import (
	"net/http"
	"time"

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
	r := gin.Default()

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

	r.Run(":8080")
}
