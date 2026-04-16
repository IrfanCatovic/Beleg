package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterPublicMiscRoutes(r *gin.Engine, cenaZahtevRateLimiter gin.HandlerFunc, usernameAvailableRateLimiter gin.HandlerFunc) {
	r.POST("/api/cena-zahtev", cenaZahtevRateLimiter, handlers.CenaZahtev)
	r.GET("/api/username-available", usernameAvailableRateLimiter, handlers.UsernameAvailable)
}
