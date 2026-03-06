package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

// RegisterZadatakRoutes registruje rute za zadatke na datu grupu.
// Grupa mora biti zaštićena AuthMiddleware-om (npr. protected = /api).
// GET /api/zadaci — lista zadataka; POST /api/zadaci — kreiranje (samo admin/sekretar).
func RegisterZadatakRoutes(g *gin.RouterGroup) {
	g.GET("/zadaci", handlers.GetZadaci)
	g.POST("/zadaci", handlers.CreateZadatak)
}
