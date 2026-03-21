package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// SecurityHeaders postavlja osnovne HTTP security header-e za sve odgovore.
func SecurityHeaders(csp string) gin.HandlerFunc {
	policy := strings.TrimSpace(csp)
	if policy == "" {
		policy = "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; img-src 'self' data: https:; connect-src 'self' https: http:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';"
	}

	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Header("Cross-Origin-Opener-Policy", "same-origin")
		c.Header("Content-Security-Policy", policy)
		c.Next()
	}
}
