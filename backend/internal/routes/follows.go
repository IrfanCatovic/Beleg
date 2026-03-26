package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterFollowRoutes(g *gin.RouterGroup) {
	g.POST("/follows/requests", handlers.CreateFollowRequestHandler)
	g.PATCH("/follows/requests/:id/accept", handlers.AcceptFollowRequestHandler)
	g.DELETE("/follows/requests/:id", handlers.RejectFollowRequestHandler)

	g.GET("/follows/requests/pending", handlers.GetPendingIncomingFollowRequestsHandler)
	g.GET("/follows/status/:targetId", handlers.GetFollowStatusHandler)
}

