package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireRoles aborts with 403 unless JWT role claim matches one of roles.
func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		if _, ok := allowed[role]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Nedovoljne privilegije", "code": "FORBIDDEN"})
			return
		}
		c.Next()
	}
}
