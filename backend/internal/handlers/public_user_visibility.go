package handlers

import (
	"errors"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var errPublicKorisnikNotFound = errors.New("korisnik nije pronađen")

// getVisiblePublicKorisnik učitava aktivnog korisnika vidljivog viewer-u.
// Missing, deleted i block (bilo koji smjer) vraćaju errPublicKorisnikNotFound.
func getVisiblePublicKorisnik(c *gin.Context, db *gorm.DB, idOrUsername string) (*models.Korisnik, error) {
	korisnik := getKorisnikByIDOrUsername(db, idOrUsername)
	if korisnik == nil {
		return nil, errPublicKorisnikNotFound
	}
	if viewer, ok := AuthUser(c); ok && viewer.ID != korisnik.ID && isBlockedEitherDirection(db, viewer.ID, korisnik.ID) {
		return nil, errPublicKorisnikNotFound
	}
	return korisnik, nil
}

func respondPublicKorisnikNotFound(c *gin.Context) {
	c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
}
