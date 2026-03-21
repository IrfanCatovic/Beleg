package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterZadatakRoutes(g *gin.RouterGroup) {
	g.GET("/zadaci", handlers.GetZadaci)
	g.GET("/zadaci/:id", handlers.GetZadatakByID)
	g.POST("/zadaci", handlers.CreateZadatak)
	g.POST("/zadaci/:id/preuzmi", handlers.PreuzmiZadatak)
	g.POST("/zadaci/:id/napusti", handlers.NapustiZadatak)
	g.PATCH("/zadaci/:id", handlers.UpdateZadatak)
	g.POST("/zadaci/:id/zavrsi", handlers.ZavrsiZadatak)
	g.DELETE("/zadaci/:id", handlers.DeleteZadatak)
}
