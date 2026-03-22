// Paket handlers za "Moj klub": stranica koju vidi svaki član kluba.
// GET /api/klub vraća podatke effective kluba (helpers.GetEffectiveClubID).
// PATCH /api/klub ažurira te podatke – samo admin ili sekretar tog kluba (ili superadmin u ulozi kluba).
// Superadmin menja limite, subskripciju i logo preko /api/superadmin/klubovi/:id; ovde klub menja osnovne podatke (naziv, adresa, kontakt, itd.).
package handlers

import (
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetMojKlub vraća podatke kluba za trenutni kontekst (effective club).
// Svi ulogovani članovi kluba mogu da vide; superadmin mora da pošalje X-Club-Id.
func GetMojKlub(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Niste u klubu"})
		return
	}

	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"klub": klub})
}

// updateMojKlubRequest polja koja klub (admin/sekretar) može da menja.
// Limite, subskripciju i OnHold menja samo superadmin preko superadmin ruta.
type updateMojKlubRequest struct {
	Naziv           *string `json:"naziv"`
	Adresa          *string `json:"adresa"`
	Telefon         *string `json:"telefon"`
	Email           *string `json:"email"`
	MaticniBroj     *string `json:"maticni_broj"`
	PIB             *string `json:"pib"`
	ZiroRacun       *string `json:"ziro_racun"`
	Sediste         *string `json:"sediste"`
	WebSajt         *string `json:"web_sajt"`
	DatumOsnivanja  *string `json:"datum_osnivanja"` // YYYY-MM-DD
}

func parseOptionalDate(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

// canEditClub vraća da li trenutni korisnik sme da menja podatke kluba (admin, sekretar tog kluba ili superadmin).
func canEditClub(c *gin.Context, db *gorm.DB, clubID uint) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role == "superadmin" {
		return true
	}
	if role != "admin" && role != "sekretar" {
		return false
	}
	usernameVal, _ := c.Get("username")
	username, _ := usernameVal.(string)
	var k models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&k).Error; err != nil {
		return false
	}
	return k.KlubID != nil && *k.KlubID == clubID
}

// UpdateMojKlub ažurira osnovne podatke effective kluba (naziv, adresa, kontakt, itd.).
// Samo admin ili sekretar tog kluba, ili superadmin kada je izabrao taj klub.
func UpdateMojKlub(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Niste u klubu"})
		return
	}

	if !canEditClub(c, db, clubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar kluba mogu da menjaju podatke kluba"})
		return
	}

	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}

	var req updateMojKlubRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva: " + err.Error()})
		return
	}

	if req.Naziv != nil {
		n := strings.TrimSpace(*req.Naziv)
		if n == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv kluba ne sme biti prazan"})
			return
		}
		klub.Naziv = n
	}
	if req.Adresa != nil {
		klub.Adresa = strings.TrimSpace(*req.Adresa)
	}
	if req.Telefon != nil {
		klub.Telefon = strings.TrimSpace(*req.Telefon)
	}
	if req.Email != nil {
		klub.Email = strings.TrimSpace(*req.Email)
	}
	if req.MaticniBroj != nil {
		klub.MaticniBroj = strings.TrimSpace(*req.MaticniBroj)
	}
	if req.PIB != nil {
		klub.PIB = strings.TrimSpace(*req.PIB)
	}
	if req.ZiroRacun != nil {
		klub.ZiroRacun = strings.TrimSpace(*req.ZiroRacun)
	}
	if req.Sediste != nil {
		klub.Sediste = strings.TrimSpace(*req.Sediste)
	}
	if req.WebSajt != nil {
		klub.WebSajt = strings.TrimSpace(*req.WebSajt)
	}
	if req.DatumOsnivanja != nil {
		if t := parseOptionalDate(*req.DatumOsnivanja); t != nil {
			klub.DatumOsnivanja = *t
		}
	}

	if err := db.Save(&klub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"klub": klub})
}
