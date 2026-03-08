package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterObavestenjaRoutes(g *gin.RouterGroup) {
	g.GET("/obavestenja", handlers.GetObavestenja)
	g.GET("/obavestenja/unread-count", handlers.GetUnreadCount)
	g.PATCH("/obavestenja/read-all", handlers.MarkAllRead)
	g.PATCH("/obavestenja/:id/read", handlers.MarkRead)
	g.POST("/obavestenja/broadcast", handlers.Broadcast)
}
