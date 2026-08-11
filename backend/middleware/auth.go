package middleware

import (
	"net/http"
	"strings"

	"beleg-app/backend/internal/helpers"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const authCookieName = "auth_token"

// SetAuthCookie postavlja HttpOnly cookie sa JWT tokenom.
// sameSiteNone: true za cross-site (npr. frontend na Vercel, API na Railway); false za Lax.
func SetAuthCookie(c *gin.Context, token string, maxAgeSeconds int, secure bool, sameSiteNone bool) {
	sameSite := http.SameSiteLaxMode
	if sameSiteNone {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     authCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAgeSeconds,
		Secure:   secure,
		HttpOnly: true,
		SameSite: sameSite,
	})
}

// ClearAuthCookie briše auth cookie (za logout).
func ClearAuthCookie(c *gin.Context, secure bool, sameSiteNone bool) {
	sameSite := http.SameSiteLaxMode
	if sameSiteNone {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   secure,
		HttpOnly: true,
		SameSite: sameSite,
	})
}

// GetTokenFromRequest prvo traži Bearer (SPA u produkciji šalje token iz localStorage),
// pa cookie — tako zastareo ili pogrešan cookie ne blokira validan Authorization.
func GetTokenFromRequest(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		if t := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer ")); t != "" {
			return t
		}
	}
	if tok, err := c.Cookie(authCookieName); err == nil && strings.TrimSpace(tok) != "" {
		return strings.TrimSpace(tok)
	}
	return ""
}

// jwtUsernameClaimValid vraća kanonski username ili false ako claim nije validan string identitet.
// JWT role claim se ne koristi za autorizaciju — LoadUserMiddleware postavlja DB role.
func jwtUsernameClaimValid(claims jwt.MapClaims) (string, bool) {
	raw, ok := claims["username"]
	if !ok || raw == nil {
		return "", false
	}
	usernameClaim, ok := raw.(string)
	if !ok {
		return "", false
	}
	username := helpers.NormalizeUsername(usernameClaim)
	// Canonical dužina kao u ValidateUsername (2–30); prazan/whitespace → unauthorized.
	if len(username) < 2 || len(username) > 30 {
		return "", false
	}
	return username, true
}

// AuthMiddleware prima isti JWT secret kao main (nakon godotenv.Load()), da verifikacija odgovara potpisivanju.
// Token: Authorization Bearer (prioritet) ili HttpOnly cookie auth_token.
// JWT potvrđuje session/identitet; role claim je samo informativan dok LoadUser ne postavi DB role.
func AuthMiddleware(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := GetTokenFromRequest(c)

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

		if purpose, _ := claims["purpose"].(string); purpose != "" && purpose != "session" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		username, ok := jwtUsernameClaimValid(claims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		c.Set("username", username)
		// Informativno do LoadUser; autorizacija mora koristiti DB role nakon LoadUserMiddleware.
		c.Set("role", claims["role"])

		c.Next()
	}
}
