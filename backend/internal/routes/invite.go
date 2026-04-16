package routes

import (
	"beleg-app/backend/internal/handlers"
	"beleg-app/backend/middleware"
	"time"

	"github.com/gin-gonic/gin"
)

func RegisterInviteRoutes(r *gin.Engine, protected *gin.RouterGroup, registerRateLimiter gin.HandlerFunc) {
	inviteValidateRateLimiter := middleware.NewIPRateLimiter(40, time.Minute)
	r.POST("/api/invite-code/validate", inviteValidateRateLimiter, handlers.ValidateInviteCode)
	r.POST("/api/register/invite", registerRateLimiter, handlers.RegisterInvite)
	protected.GET("/klub/invite-code", handlers.GetInviteCodeForAdmin)
	protected.POST("/klub/invite-code/regenerate", handlers.RegenerateInviteCode)
}
