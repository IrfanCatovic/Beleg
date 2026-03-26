package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterFollowRoutes(g *gin.RouterGroup) {
	g.POST("/follows/requests", handlers.CreateFollowRequestHandler)
	g.PATCH("/follows/requests/:id/accept", handlers.AcceptFollowRequestHandler)
	g.DELETE("/follows/requests/:id", handlers.RejectFollowRequestHandler)
	g.DELETE("/follows/user/:targetId", handlers.UnfollowUserHandler)

	g.GET("/follows/requests/pending", handlers.GetPendingIncomingFollowRequestsHandler)
	g.GET("/follows/status/:targetId", handlers.GetFollowStatusHandler)

	g.GET("/follows/user/:id/counts", handlers.GetFollowCountsHandler)
	g.GET("/follows/user/:id/following", handlers.GetFollowingListHandler)
	g.GET("/follows/user/:id/followers", handlers.GetFollowersListHandler)
}

