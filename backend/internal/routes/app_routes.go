package routes

import (
	"beleg-app/backend/middleware"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterAppRoutes(r *gin.Engine, db *gorm.DB, jwtSecret []byte) {
	// Public rute
	loginRateLimiter := middleware.NewIPRateLimiter(12, time.Minute)
	cenaZahtevRateLimiter := middleware.NewIPRateLimiter(5, 10*time.Minute)
	usernameAvailableRateLimiter := middleware.NewIPRateLimiter(40, time.Minute)
	registerRateLimiter := middleware.NewIPRateLimiter(8, 10*time.Minute)
	resendEmailRateLimiter := middleware.NewIPRateLimiter(8, 10*time.Minute)
	setupAdminRateLimiter := middleware.NewIPRateLimiter(5, 10*time.Minute)

	RegisterSetupPublicRoutes(r, db, setupAdminRateLimiter)
	RegisterAuthPublicRoutes(r, db, jwtSecret, loginRateLimiter)
	RegisterPublicMiscRoutes(
		r,
		db,
		cenaZahtevRateLimiter,
		usernameAvailableRateLimiter,
		registerRateLimiter,
		resendEmailRateLimiter,
	)

	RegisterUsersPublicRoutes(r)

	// PROTECTED RUTE SVE UNUTAR JEDNOG BLOKA
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(jwtSecret))
	protected.Use(middleware.ClubHoldMiddleware())
	{
		RegisterClubMembershipRoutes(r, protected, db)
		RegisterFinanceRoutes(protected)
		RegisterZadatakRoutes(protected)
		RegisterObavestenjaRoutes(protected)
		RegisterClubRoutes(protected)
		RegisterFollowRoutes(protected)
		RegisterPostRoutes(protected)

		RegisterSuperadminRoutes(protected)
		RegisterActionRoutes(r, protected, jwtSecret)
		RegisterActionParticipationRequestRoutes(protected)

		RegisterRegistrationRoutes(r, db, jwtSecret, registerRateLimiter)

		RegisterInviteRoutes(r, protected, registerRateLimiter)

		RegisterProfileRoutes(protected, jwtSecret)

		RegisterUsersAdminRoutes(protected)
	}

}
