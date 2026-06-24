package middleware

import (
	"beleg-app/backend/internal/apperror"

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
			apperror.Abort(c, apperror.ErrForbidden)
			return
		}
		c.Next()
	}
}
