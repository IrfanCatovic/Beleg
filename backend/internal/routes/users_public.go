package routes

import (
	"beleg-app/backend/internal/handlers"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterUsersPublicRoutes(r *gin.Engine, jwtSecret []byte) {
	optionalAuth := middleware.OptionalLoadUserMiddleware(jwtSecret)
	r.GET("/api/korisnici/:id", optionalAuth, handlers.GetPublicKorisnik)
	r.GET("/api/korisnici/:id/statistika", handlers.GetPublicKorisnikStatistika)
	r.GET("/api/korisnici/:id/popeo-se", handlers.GetPublicKorisnikPopeoSe)
	r.GET("/api/korisnici/:id/vodio", handlers.GetPublicKorisnikVodio)
	r.GET("/api/korisnici/:id/recenzije-vodica", handlers.GetPublicKorisnikGuideRecenzije)
}
