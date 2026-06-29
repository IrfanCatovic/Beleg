package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterPushTokenRoutes(g *gin.RouterGroup) {
	g.GET("/push-tokens", handlers.GetMyPushTokens)
	g.PUT("/push-tokens", handlers.RegisterPushToken)
	g.DELETE("/push-tokens", handlers.DeletePushToken)
}
