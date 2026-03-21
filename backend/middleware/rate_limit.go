package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimitEntry struct {
	count     int
	windowEnd time.Time
}

// NewIPRateLimiter pravi jednostavan fixed-window limiter po IP adresi i ruti.
// Primer: NewIPRateLimiter(10, time.Minute) => max 10 zahteva po minutu za isti IP + endpoint.
func NewIPRateLimiter(maxRequests int, window time.Duration) gin.HandlerFunc {
	if maxRequests <= 0 {
		maxRequests = 1
	}
	if window <= 0 {
		window = time.Minute
	}

	var (
		mu      sync.Mutex
		entries = make(map[string]rateLimitEntry)
	)

	return func(c *gin.Context) {
		now := time.Now()
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}
		key := c.ClientIP() + "|" + route

		mu.Lock()
		// Povremeno očisti istekle ključeve da mapa ne raste beskonačno.
		for k, v := range entries {
			if now.After(v.windowEnd) {
				delete(entries, k)
			}
		}

		entry, exists := entries[key]
		if !exists || now.After(entry.windowEnd) {
			entry = rateLimitEntry{count: 0, windowEnd: now.Add(window)}
		}

		entry.count++
		entries[key] = entry
		remaining := maxRequests - entry.count
		retryAfter := int(time.Until(entry.windowEnd).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		overLimit := entry.count > maxRequests
		mu.Unlock()

		c.Header("X-RateLimit-Limit", strconv.Itoa(maxRequests))
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))

		if overLimit {
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Previše zahteva. Pokušajte ponovo za nekoliko trenutaka.",
			})
			return
		}

		c.Next()
	}
}
