package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterActivityRoutes(protected *gin.RouterGroup) {
	// Daily steps
	protected.GET("/me/steps/today", handlers.GetTodaySteps)
	protected.PUT("/me/steps/goal", handlers.UpdateStepGoal)
	protected.POST("/me/steps/sync", handlers.SyncDailySteps)
	protected.GET("/me/activity-stats", handlers.GetMyActivityStats)

	// Tracked activities (GPS sessions)
	protected.POST("/activities/start", handlers.StartTrackedActivity)
	protected.GET("/activities/active", handlers.GetActiveTrackedActivity)
	protected.GET("/me/activities", handlers.GetMyTrackedActivities)
	protected.GET("/activities/:id", handlers.GetTrackedActivity)
	protected.POST("/activities/:id/points", handlers.AppendTrackedActivityPoints)
	protected.POST("/activities/:id/finish", handlers.FinishTrackedActivity)
	protected.POST("/activities/:id/discard", handlers.DiscardTrackedActivity)

	// Leaderboards
	protected.GET("/leaderboards/steps", handlers.GetStepsLeaderboard)
}
