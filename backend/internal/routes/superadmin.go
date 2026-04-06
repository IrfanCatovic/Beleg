package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterSuperadminRoutes(g *gin.RouterGroup) {
	g.GET("/superadmin/app-stats", handlers.GetSuperadminAppStats)
	g.GET("/superadmin/klubovi", handlers.GetKlubovi)
	g.POST("/superadmin/klubovi", handlers.CreateKlub)
	g.PATCH("/superadmin/klubovi/:id", handlers.UpdateKlub)
	g.DELETE("/superadmin/klubovi/:id", handlers.DeleteKlub)
}
