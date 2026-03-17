package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterPostRoutes(g *gin.RouterGroup) {
	g.GET("/posts", handlers.GetPosts)
	g.POST("/posts", handlers.CreatePost)
	g.DELETE("/posts/:id", handlers.DeletePost)
}
