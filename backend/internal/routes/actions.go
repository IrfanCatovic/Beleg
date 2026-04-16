package routes

import (
	"beleg-app/backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterActionRoutes(r *gin.Engine, protected *gin.RouterGroup, jwtSecret []byte) {
	r.GET("/api/akcije/:id", handlers.GetPublicAkcijaByID(jwtSecret))

	protected.GET("/akcije", handlers.GetAkcije)
	protected.POST("/akcije", handlers.CreateAkcija)
	protected.PATCH("/akcije/:id", handlers.UpdateAkcija)
	protected.POST("/akcije/:id/prijavi", handlers.PrijaviNaAkciju)
	protected.GET("/akcije/:id/moja-prijava", handlers.GetMojaPrijavaZaAkciju)
	protected.PATCH("/akcije/:id/moja-prijava", handlers.UpdateMojaPrijavaIzbori)
	protected.GET("/akcije/:id/prijave", handlers.GetPrijaveZaAkciju)
	protected.POST("/akcije/:id/prevoz", handlers.DodajPrevozZaAkciju)
	protected.DELETE("/akcije/:id/prevoz/:prevozId", handlers.ObrisiPrevozZaAkciju)
	protected.GET("/akcije/:id/prevoz-prijave", handlers.GetPrevozPrijave)
	protected.POST("/akcije/:id/dodaj-clana-popeo-se", handlers.DodajClanaPopeoSe)
	protected.POST("/akcije/:id/zavrsi", handlers.ZavrsiAkciju)
	protected.DELETE("/akcije/:id", handlers.DeleteAkcija)
	protected.DELETE("/akcije/:id/prijavi", handlers.OtkaziPrijavuNaAkciju)

	protected.GET("/moje-popeo-se", handlers.GetMojePopeoSe)
	protected.POST("/prijave/:id/status", handlers.UpdatePrijavaStatus)
	protected.PATCH("/prijave/:id/platio", handlers.UpdatePrijavaPlatioStatus)
	protected.DELETE("/prijave/:id", handlers.DeletePrijava)
	protected.GET("/moje-prijave", handlers.GetMojePrijave)
}
