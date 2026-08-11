package routes

import (
	"beleg-app/backend/internal/googleidtoken"
	"beleg-app/backend/internal/handlers"
	"beleg-app/backend/middleware"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterSetupPublicRoutes(r *gin.Engine, db *gorm.DB, setupAdminRateLimiter gin.HandlerFunc) {
	r.GET("/api/setup/status", handlers.GetSetupStatus(db))
	// Register /id/:id before /:naziv so "id" is not captured as a club name.
	r.GET("/api/klubovi/id/:id", handlers.GetPublicKlubByID(db))
	r.GET("/api/klubovi/:naziv", handlers.GetPublicKlubByNaziv(db))
	r.POST("/api/setup/admin", setupAdminRateLimiter, handlers.RegisterSetupAdmin(db))
}

func RegisterAuthPublicRoutes(r *gin.Engine, db *gorm.DB, jwtSecret []byte, loginRateLimiter gin.HandlerFunc) {
	r.POST("/login", loginRateLimiter, handlers.Login(db, jwtSecret))
	r.POST("/api/login", loginRateLimiter, handlers.Login(db, jwtSecret))
	r.POST("/api/logout", handlers.Logout())

	googleRateLimiter := middleware.NewIPRateLimiter(12, time.Minute)
	googleVerifier := googleidtoken.NewGoogleVerifier(googleidtoken.AudiencesFromEnv())
	r.POST("/api/auth/social/google", googleRateLimiter, handlers.StartGoogleAuth(jwtSecret, googleVerifier))
	r.POST("/api/auth/social/google/complete", googleRateLimiter, handlers.CompleteGoogleOnboarding(jwtSecret))
}
