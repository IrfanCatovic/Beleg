package handlers

import (
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)


func requireSuperadmin(c *gin.Context) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo superadmin može pristupiti"})
		return false
	}
	return true
}

func GetKlubovi(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)
	var klubovi []models.Klubovi
	if err := db.Order("naziv").Find(&klubovi).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju klubova"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"klubovi": klubovi})
}

// createKlubRequest body za POST /superadmin/klubovi
type createKlubRequest struct {
	Naziv                string   `json:"naziv"`
	Adresa               string   `json:"adresa"`
	Telefon              string   `json:"telefon"`
	Email                string   `json:"email"`
	MaticniBroj          string   `json:"maticni_broj"`
	PIB                  string   `json:"pib"`
	ZiroRacun            string   `json:"ziro_racun"`
	Sediste              string   `json:"sediste"`
	WebSajt              string   `json:"web_sajt"`
	DatumOsnivanja       string   `json:"datum_osnivanja"` // YYYY-MM-DD
	KorisnikAdminLimit   int      `json:"korisnik_admin_limit"`
	KorisnikLimit        int      `json:"korisnik_limit"`
	MaxStorageGB         float64  `json:"max_storage_gb"`
	SubscribedAt         string   `json:"subscribedAt"`         // YYYY-MM-DD
	SubscriptionEndsAt   string   `json:"subscriptionEndsAt"`  // YYYY-MM-DD
	LogoURL              string   `json:"logoUrl"`
}

func parseDate(s string) *time.Time {
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

// CreateKlub kreira novi klub (samo superadmin). Body: JSON.
func CreateKlub(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	var req createKlubRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva: " + err.Error()})
		return
	}
	naziv := strings.TrimSpace(req.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv kluba je obavezan"})
		return
	}
	if req.KorisnikAdminLimit < 0 || req.KorisnikLimit < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Limit broja admina i članova ne sme biti negativan"})
		return
	}
	if req.MaxStorageGB < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max storage (GB) ne sme biti negativan"})
		return
	}

	// Defaults ako nisu poslati
	if req.KorisnikAdminLimit == 0 {
		req.KorisnikAdminLimit = 3
	}
	if req.KorisnikLimit == 0 {
		req.KorisnikLimit = 100
	}
	if req.MaxStorageGB == 0 {
		req.MaxStorageGB = 10.0
	}

	klub := models.Klubovi{
		Naziv:               naziv,
		Adresa:              strings.TrimSpace(req.Adresa),
		Telefon:             strings.TrimSpace(req.Telefon),
		Email:               strings.TrimSpace(req.Email),
		MaticniBroj:         strings.TrimSpace(req.MaticniBroj),
		PIB:                 strings.TrimSpace(req.PIB),
		ZiroRacun:           strings.TrimSpace(req.ZiroRacun),
		Sediste:             strings.TrimSpace(req.Sediste),
		WebSajt:             strings.TrimSpace(req.WebSajt),
		KorisnikAdminLimit:  req.KorisnikAdminLimit,
		KorisnikLimit:       req.KorisnikLimit,
		MaxStorageGB:        req.MaxStorageGB,
		SubscribedAt:        parseDate(req.SubscribedAt),
		SubscriptionEndsAt:  parseDate(req.SubscriptionEndsAt),
		LogoURL:             strings.TrimSpace(req.LogoURL),
	}
	if s := strings.TrimSpace(req.DatumOsnivanja); s != "" {
		if t := parseDate(s); t != nil {
			klub.DatumOsnivanja = *t
		}
	}

	if err := db.Create(&klub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"klub": klub})
}
