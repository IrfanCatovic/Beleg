package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterRegistrationRoutes(r *gin.Engine, db *gorm.DB, jwtSecret []byte, registerRateLimiter gin.HandlerFunc) {
	r.POST("/api/register", registerRateLimiter, handlers.RegisterUser(db, jwtSecret))
}
