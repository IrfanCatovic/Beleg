package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

// RegisterFinanceRoutes registruje sve rute za finansije na datu grupu.
// Grupa mora biti već zaštićena AuthMiddleware-om (npr. protected /api).
// Provera uloge (admin/blagajnik) je unutar handlera.
func RegisterFinanceRoutes(g *gin.RouterGroup) {
	g.GET("/finansije", handlers.GetTransakcije)
}
