package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireAnyRole returns false and writes 403 when the JWT role is not in roles.
func RequireAnyRole(c *gin.Context, message string, roles ...string) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	for _, allowed := range roles {
		if role == allowed {
			return true
		}
	}
	c.JSON(http.StatusForbidden, gin.H{"error": message})
	return false
}
