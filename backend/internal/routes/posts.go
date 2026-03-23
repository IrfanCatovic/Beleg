package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterPostRoutes(g *gin.RouterGroup) {
	g.GET("/posts", handlers.GetPosts)
	g.POST("/posts", handlers.CreatePost)
	g.GET("/posts/:id", handlers.GetPost)
	g.DELETE("/posts/:id", handlers.DeletePost)

	g.POST("/posts/:id/like", handlers.TogglePostLike)
	g.GET("/posts/:id/likes", handlers.GetPostLikes)
	g.GET("/posts/:id/comments", handlers.GetPostComments)
	g.POST("/posts/:id/comments", handlers.CreatePostComment)
}
