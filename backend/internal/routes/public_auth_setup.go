package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterSetupPublicRoutes(r *gin.Engine, db *gorm.DB, setupAdminRateLimiter gin.HandlerFunc) {
	r.GET("/api/setup/status", handlers.GetSetupStatus(db))
	r.GET("/api/klubovi/:naziv", handlers.GetPublicKlubByNaziv(db))
	r.POST("/api/setup/admin", setupAdminRateLimiter, handlers.RegisterSetupAdmin(db))
}

func RegisterAuthPublicRoutes(r *gin.Engine, db *gorm.DB, jwtSecret []byte, loginRateLimiter gin.HandlerFunc) {
	r.POST("/login", loginRateLimiter, handlers.Login(db, jwtSecret))
	r.POST("/api/logout", handlers.Logout())
}
