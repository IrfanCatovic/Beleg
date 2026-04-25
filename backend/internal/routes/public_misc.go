package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterPublicMiscRoutes(
	r *gin.Engine,
	db *gorm.DB,
	cenaZahtevRateLimiter gin.HandlerFunc,
	usernameAvailableRateLimiter gin.HandlerFunc,
	openRegisterRateLimiter gin.HandlerFunc,
	resendEmailRateLimiter gin.HandlerFunc,
	forgotPasswordRateLimiter gin.HandlerFunc,
) {
	r.POST("/api/cena-zahtev", cenaZahtevRateLimiter, handlers.CenaZahtev)
	r.GET("/api/username-available", usernameAvailableRateLimiter, handlers.UsernameAvailable)
	r.POST("/api/register/open", openRegisterRateLimiter, handlers.RegisterOpen(db))
	r.GET("/api/email/verify", handlers.VerifyEmail)
	r.POST("/api/email/resend", resendEmailRateLimiter, handlers.ResendVerificationEmail)
	r.POST("/api/password/forgot", forgotPasswordRateLimiter, handlers.ForgotPassword)
	r.POST("/api/password/reset", forgotPasswordRateLimiter, handlers.ResetPassword)
}
