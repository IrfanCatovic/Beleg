package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterUsersPublicRoutes(r *gin.Engine) {
	r.GET("/api/korisnici/:id", handlers.GetPublicKorisnik)
	r.GET("/api/korisnici/:id/statistika", handlers.GetPublicKorisnikStatistika)
	r.GET("/api/korisnici/:id/popeo-se", handlers.GetPublicKorisnikPopeoSe)
}
