package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterActionRoutes(r *gin.Engine, protected *gin.RouterGroup, jwtSecret []byte) {
	r.GET("/api/akcije/:id", handlers.GetPublicAkcijaByID(jwtSecret))

	protected.GET("/akcije", handlers.GetAkcije)
	protected.POST("/akcije", handlers.CreateAkcija)
	protected.PATCH("/akcije/:id", handlers.UpdateAkcija)
	protected.POST("/akcije/:id/prijavi", handlers.PrijaviNaAkciju)
	protected.GET("/akcije/:id/moja-prijava", handlers.GetMojaPrijavaZaAkciju)
	protected.PATCH("/akcije/:id/moja-prijava", handlers.UpdateMojaPrijavaIzbori)
	protected.GET("/akcije/:id/prijave", handlers.GetPrijaveZaAkciju)
	protected.POST("/akcije/:id/prevoz", handlers.DodajPrevozZaAkciju)
	protected.DELETE("/akcije/:id/prevoz/:prevozId", handlers.ObrisiPrevozZaAkciju)
	protected.GET("/akcije/:id/prevoz-prijave", handlers.GetPrevozPrijave)
	protected.POST("/akcije/:id/dodaj-clana-popeo-se", handlers.DodajClanaPopeoSe)
	protected.POST("/akcije/:id/add-club-members-completed", handlers.BulkAddClubMembersCompleted)
	protected.POST("/akcije/:id/zavrsi", handlers.ZavrsiAkciju)
	protected.GET("/akcije/:id/guide-rating/mine", handlers.GetMyGuideRatingForAkcija)
	protected.POST("/akcije/:id/guide-rating", handlers.SubmitGuideRatingForAkcija)
	protected.DELETE("/akcije/:id", handlers.DeleteAkcija)
	protected.DELETE("/akcije/:id/prijavi", handlers.OtkaziPrijavuNaAkciju)
	protected.GET("/akcije/:id/signup-requests", handlers.GetActionSignupRequests)
	protected.GET("/akcije/:id/signup-requests/:requestId", handlers.GetActionSignupRequestByID)
	protected.POST("/akcije/:id/signup-requests/:requestId/respond", handlers.RespondToActionSignupRequest)
	protected.DELETE("/akcije/:id/signup-requests/moj", handlers.CancelMojActionSignupRequest)
	protected.GET("/moji-signup-requests", handlers.GetMojiActionSignupRequests)
	protected.POST("/akcije/:id/invite-link/regenerate", handlers.CreateOrRegenerateActionInviteLink)
	protected.POST("/akcije/:id/invite-link/revoke", handlers.RevokeActionInviteLink)

	protected.GET("/moje-popeo-se", handlers.GetMojePopeoSe)
	protected.POST("/prijave/:id/status", handlers.UpdatePrijavaStatus)
	protected.PATCH("/prijave/:id/platio", handlers.UpdatePrijavaPlatioStatus)
	protected.DELETE("/prijave/:id", handlers.DeletePrijava)
	protected.GET("/moje-prijave", handlers.GetMojePrijave)
}
