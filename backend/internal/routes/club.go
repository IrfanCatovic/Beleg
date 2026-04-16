package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

// RegisterClubRoutes registruje rute za "Moj klub" (stranica Klub).
// GET /api/klub – podaci effective kluba (svi članovi mogu da vide).
// PATCH /api/klub – ažuriranje podataka kluba (samo admin/sekretar tog kluba ili superadmin).
func RegisterClubRoutes(g *gin.RouterGroup) {
	g.GET("/klub/admin-stats", handlers.GetClubAdminStats)
	g.GET("/klub", handlers.GetMojKlub)
	g.PATCH("/klub", handlers.UpdateMojKlub)
	g.PATCH("/klub/logo", handlers.UpdateMojKlubLogo)
}
