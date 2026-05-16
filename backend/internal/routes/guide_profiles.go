package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterGuideProfileRoutes(g *gin.RouterGroup) {
	g.POST("/guide-profiles/apply", handlers.ApplyGuideProfile)
	g.GET("/me/guide-profile", handlers.GetMyGuideProfile)
	g.PUT("/me/guide-profile", handlers.UpdateMyGuideProfile)
}


