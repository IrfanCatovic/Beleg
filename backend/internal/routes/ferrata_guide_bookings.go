package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterFerrataGuideBookingRoutes(g *gin.RouterGroup) {
	g.POST("/ferrata-guide-bookings", handlers.CreateFerrataGuideBooking)
	g.GET("/ferrata-guide-bookings/:id", handlers.GetFerrataGuideBooking)
}
