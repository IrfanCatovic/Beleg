package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET")) // isti kao u main.go

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		fmt.Println("Middleware: Received header:", authHeader)

		if authHeader == "" {
			fmt.Println("Middleware: No header")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		authHeader = strings.TrimSpace(authHeader)
		if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			fmt.Println("Middleware: Invalid prefix, got:", authHeader)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		tokenStr = strings.TrimSpace(tokenStr)
		fmt.Println("Middleware: Token (prvih 30):", tokenStr[:30]+"...")

		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				fmt.Println("Middleware: Wrong signing method")
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret, nil
		})

		if err != nil {
			fmt.Println("Middleware: Parse error:", err.Error())
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		if !token.Valid {
			fmt.Println("Middleware: Token not valid")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		fmt.Println("Middleware: SUCCESS! Claims:", claims)

		c.Set("username", claims["username"])
		c.Set("role", claims["role"])

		c.Next()
	}
}
