package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const authCookieName = "auth_token"

// SetAuthCookie postavlja HttpOnly cookie sa JWT tokenom.
func SetAuthCookie(c *gin.Context, token string, maxAgeSeconds int, secure bool) {
	c.SetCookie(authCookieName, token, maxAgeSeconds, "/", "", secure, true)
}

// ClearAuthCookie briše auth cookie (za logout).
func ClearAuthCookie(c *gin.Context) {
	c.SetCookie(authCookieName, "", -1, "/", "", false, true)
}

// getTokenFromRequest prvo traži token u HttpOnly cookie, pa u Authorization header.
func getTokenFromRequest(c *gin.Context) string {
	if tok, err := c.Cookie(authCookieName); err == nil && strings.TrimSpace(tok) != "" {
		return strings.TrimSpace(tok)
	}
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}
	return ""
}

// AuthMiddleware prima isti JWT secret kao main (nakon godotenv.Load()), da verifikacija odgovara potpisivanju.
// Token može biti u cookie (auth_token) ili u Authorization header.
func AuthMiddleware(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := getTokenFromRequest(c)

		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Niste prijavljeni"})
			return
		}
		if len(tokenStr) < 10 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret, nil
		})

		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		if !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		c.Set("username", claims["username"])
		c.Set("role", claims["role"])

		c.Next()
	}
}
