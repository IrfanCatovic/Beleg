package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterClubMembershipRoutes(r *gin.Engine, protected *gin.RouterGroup, db *gorm.DB) {
	r.GET("/api/klubovi", handlers.GetPublicKluboviList(db))

	protected.GET("/club-membership/requests/mine", handlers.GetMyClubJoinRequests)
	protected.POST("/club-membership/requests", handlers.CreateClubJoinRequest)
	protected.DELETE("/club-membership/requests/:id", handlers.CancelMyClubJoinRequest)

	protected.GET("/club-membership/requests", handlers.ListClubJoinRequestsForAdmin)
	protected.POST("/club-membership/requests/:id/accept", handlers.AcceptClubJoinRequest)
	protected.POST("/club-membership/requests/:id/reject", handlers.RejectClubJoinRequest)
	protected.POST("/club-membership/requests/:id/block", handlers.BlockClubJoinRequest)

	protected.POST("/club-membership/leave", handlers.LeaveCurrentClub)
	protected.POST("/club-membership/remove", handlers.RemoveMemberFromClub)
}
