package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterSuperadminRoutes(g *gin.RouterGroup) {
	g.GET("/superadmin/app-stats", handlers.GetSuperadminAppStats)
	g.GET("/superadmin/korisnici/bez-kluba", handlers.GetSuperadminNoClubUsers)
	g.GET("/superadmin/klubovi", handlers.GetKlubovi)
	g.POST("/superadmin/klubovi", handlers.CreateKlub)
	g.PATCH("/superadmin/klubovi/:id", handlers.UpdateKlub)
	g.PATCH("/superadmin/klubovi/:id/logo", handlers.UpdateKlubLogo)
	g.DELETE("/superadmin/klubovi/:id", handlers.DeleteKlub)
}
