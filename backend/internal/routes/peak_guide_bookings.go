package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterPeakGuideBookingRoutes(g *gin.RouterGroup) {
	g.POST("/peak-guide-bookings", handlers.CreatePeakGuideBooking)
	g.GET("/peak-guide-bookings/:id", handlers.GetPeakGuideBooking)
	g.POST("/peak-guide-bookings/:id/reject", handlers.RejectPeakGuideBooking)
	g.POST("/peak-guide-bookings/:id/accept", handlers.AcceptPeakGuideBooking)
}
