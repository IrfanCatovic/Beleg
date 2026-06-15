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

	g.GET("/superadmin/ferratas", handlers.SuperadminListFerratas)
	g.GET("/superadmin/ferratas/:id", handlers.SuperadminGetFerrata)
	g.POST("/superadmin/ferratas/cover-draft", handlers.SuperadminUploadFerrataCoverDraft)
	g.POST("/superadmin/ferratas/gallery-draft", handlers.SuperadminUploadFerrataGalleryDraft)
	g.POST("/superadmin/ferratas", handlers.SuperadminCreateFerrata)
	g.PUT("/superadmin/ferratas/:id", handlers.SuperadminUpdateFerrata)
	g.DELETE("/superadmin/ferratas/:id", handlers.SuperadminDeleteFerrata)
	g.PATCH("/superadmin/ferratas/:id/galerija", handlers.SuperadminPatchFerrataGalerija)
	g.POST("/superadmin/ferratas/:id/cover", handlers.SuperadminUploadFerrataCover)
	g.POST("/superadmin/ferratas/:id/gallery", handlers.SuperadminUploadFerrataGallery)
	g.POST("/superadmin/ferratas/:id/contacts", handlers.SuperadminCreateFerrataContact)
	g.PUT("/superadmin/ferrata-contacts/:id", handlers.SuperadminUpdateFerrataContact)

	g.GET("/superadmin/hotels", handlers.SuperadminListHotels)
	g.POST("/superadmin/hotels/gallery-draft", handlers.SuperadminUploadHotelGalleryDraft)
	g.POST("/superadmin/hotels", handlers.SuperadminCreateHotel)
	g.GET("/superadmin/hotels/:id", handlers.SuperadminGetHotel)
	g.POST("/superadmin/hotels/:id/gallery", handlers.SuperadminUploadHotelGallery)
	g.PUT("/superadmin/hotels/:id", handlers.SuperadminUpdateHotel)
	g.DELETE("/superadmin/hotels/:id", handlers.SuperadminDeleteHotel)

	g.GET("/superadmin/peaks", handlers.SuperadminListPeaks)
	g.POST("/superadmin/peaks", handlers.SuperadminCreatePeak)
	g.GET("/superadmin/peaks/:id", handlers.SuperadminGetPeak)
	g.PUT("/superadmin/peaks/:id", handlers.SuperadminUpdatePeak)
	g.DELETE("/superadmin/peaks/:id", handlers.SuperadminDeletePeak)

	g.GET("/superadmin/guide-profiles", handlers.SuperadminListGuideProfiles)
	g.GET("/superadmin/guide-profiles/pending", handlers.SuperadminListPendingGuideProfiles)
	g.PUT("/superadmin/guide-profiles/:id/approve", handlers.SuperadminApproveGuideProfile)
	g.PUT("/superadmin/guide-profiles/:id/reject", handlers.SuperadminRejectGuideProfile)
	g.PUT("/superadmin/guide-profiles/:id/suspend", handlers.SuperadminSuspendGuideProfile)
}
