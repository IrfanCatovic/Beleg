package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterUsersAdminRoutes(protected *gin.RouterGroup) {
	protected.PATCH("/korisnici/:id", handlers.UpdateKorisnikByAdmin)
	protected.DELETE("/korisnici/:id", handlers.DeleteKorisnikByAdmin)
	protected.GET("/korisnici", handlers.GetKorisnici)
	protected.GET("/korisnici/:id/info", handlers.GetKorisnikInfo)
	protected.POST("/korisnici/:id/dodaj-proslu-akciju", handlers.AddProslaAkcija)
}
