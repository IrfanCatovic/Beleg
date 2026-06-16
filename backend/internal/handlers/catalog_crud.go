package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// parseCatalogID parses uint id from gin param or writes 400/invalid response.
func parseCatalogID(c *gin.Context, param string) (uint, bool) {
	idStr := c.Param(param)
	id64, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return 0, false
	}
	return uint(id64), true
}

// catalogListResponse is the shared list envelope for superadmin catalog entities.
func catalogListResponse(key string, items any) gin.H {
	return gin.H{key: items}
}
