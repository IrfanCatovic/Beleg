package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterSuperadminRoutes(g *gin.RouterGroup) {
	g.GET("/superadmin/klubovi", handlers.GetKlubovi)
}
