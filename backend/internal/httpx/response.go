package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Error writes a JSON error response. Optional code is included when non-empty.
func Error(c *gin.Context, status int, message string, code ...string) {
	body := gin.H{"error": message}
	if len(code) > 0 && code[0] != "" {
		body["code"] = code[0]
	}
	c.JSON(status, body)
}

// OK writes a JSON success response with arbitrary data.
func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, data)
}

// Paginated writes offset/limit list responses with total count.
func Paginated(c *gin.Context, items any, total, limit, offset int) {
	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
