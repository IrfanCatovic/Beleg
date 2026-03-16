package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

// RegisterPostRoutes registruje rute za javne objave (feed) unutar /api grupe.
func RegisterPostRoutes(g *gin.RouterGroup) {
	g.GET("/posts", handlers.GetPosts)
	g.POST("/posts", handlers.CreatePost)
}

