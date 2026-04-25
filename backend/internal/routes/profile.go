package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterProfileRoutes(protected *gin.RouterGroup, jwtSecret []byte) {
	protected.GET("/me", handlers.GetMe)
	protected.PATCH("/me", handlers.UpdateMe(jwtSecret))
	protected.PATCH("/me/avatar", handlers.UpdateMeAvatar)
	protected.PATCH("/me/cover-position", handlers.UpdateMeCoverPosition)
	protected.PATCH("/me/cover", handlers.UpdateMeCover)
}
