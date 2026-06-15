package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterFerrataPublicRoutes(r *gin.Engine) {
	r.GET("/api/hotels", handlers.ListHotelsAll)
	r.GET("/api/hotels/nearby", handlers.ListHotelsNearby)
	r.GET("/api/guides", handlers.ListGuidesCatalog)
	r.GET("/api/guides/nearby", handlers.ListGuidesNearby)
	r.GET("/api/ferratas", handlers.ListFerratas)
	r.GET("/api/ferratas/slug/:slug", handlers.GetFerrataBySlug)
	r.GET("/api/ferratas/:id/contacts", handlers.GetFerrataContactsByFerrataID)
	r.GET("/api/ferratas/:id/upcoming-actions", handlers.GetFerrataUpcomingActions)
}
