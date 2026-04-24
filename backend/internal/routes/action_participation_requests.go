package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterActionParticipationRequestRoutes(protected *gin.RouterGroup) {
	protected.GET("/akcije/:id/eligible-external-users", handlers.SearchEligibleExternalUsers)
	protected.GET("/akcije/:id/participation-requests", handlers.ListActionParticipationRequests)
	protected.POST("/akcije/:id/participation-requests", handlers.CreateActionParticipationRequest)
	protected.PATCH("/akcije/:id/participation-requests/:requestId/cancel", handlers.CancelActionParticipationRequest)

	protected.GET("/moja-ucesca-zahtevi", handlers.ListMyActionParticipationRequests)
	protected.GET("/moja-ucesca-zahtevi/:id", handlers.GetMyActionParticipationRequest)
	protected.POST("/moja-ucesca-zahtevi/:id/respond", handlers.RespondToActionParticipationRequest)
}
