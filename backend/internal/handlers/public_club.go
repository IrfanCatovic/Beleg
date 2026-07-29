package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PublicClubDTO is the only shape returned by public club list/detail endpoints.
type PublicClubDTO struct {
	ID             uint       `json:"id"`
	Naziv          string     `json:"naziv"`
	LogoURL        string     `json:"logoUrl,omitempty"`
	Sediste        string     `json:"sediste,omitempty"`
	WebSajt        string     `json:"web_sajt,omitempty"`
	DatumOsnivanja *time.Time `json:"datum_osnovanja,omitempty"`
}

func toPublicClubDTO(k models.Klubovi) PublicClubDTO {
	out := PublicClubDTO{
		ID:      k.ID,
		Naziv:   k.Naziv,
		LogoURL: k.LogoURL,
		Sediste: k.Sediste,
		WebSajt: k.WebSajt,
	}
	if !k.DatumOsnivanja.IsZero() {
		t := k.DatumOsnivanja
		out.DatumOsnivanja = &t
	}
	return out
}

func publicClubQuery(db *gorm.DB) *gorm.DB {
	// onHold clubs are treated as unavailable for public discovery (same as not found).
	return db.Model(&models.Klubovi{}).Where("on_hold = ?", false)
}

func writePublicClubNotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
}

func writePublicClubDTO(c *gin.Context, klub models.Klubovi) {
	c.JSON(http.StatusOK, gin.H{"klub": toPublicClubDTO(klub)})
}

// GetPublicKluboviList GET /api/klubovi — public browse/search (safe DTO only).
func GetPublicKluboviList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		q := publicClubQuery(db)
		if search != "" {
			like := "%" + strings.ToLower(search) + "%"
			q = q.Where("LOWER(naziv) LIKE ?", like)
		}
		var klubovi []models.Klubovi
		if err := q.Order("naziv ASC").Limit(50).Find(&klubovi).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju klubova"})
			return
		}
		out := make([]PublicClubDTO, 0, len(klubovi))
		for _, k := range klubovi {
			out = append(out, toPublicClubDTO(k))
		}
		c.JSON(http.StatusOK, gin.H{"klubovi": out})
	}
}

// GetPublicKlubByNaziv GET /api/klubovi/:naziv — legacy public lookup by name (safe DTO only).
func GetPublicKlubByNaziv(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		naziv := strings.TrimSpace(c.Param("naziv"))
		if naziv == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv kluba je obavezan"})
			return
		}

		var klub models.Klubovi
		if err := publicClubQuery(db).Where("naziv = ?", naziv).First(&klub).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				writePublicClubNotFound(c)
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju kluba"})
			return
		}
		writePublicClubDTO(c, klub)
	}
}

// GetPublicKlubByID GET /api/klubovi/id/:id — canonical public lookup by stable id (safe DTO only).
func GetPublicKlubByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := strings.TrimSpace(c.Param("id"))
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil || id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći id kluba"})
			return
		}

		var klub models.Klubovi
		if err := publicClubQuery(db).Where("id = ?", uint(id)).First(&klub).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				writePublicClubNotFound(c)
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju kluba"})
			return
		}
		writePublicClubDTO(c, klub)
	}
}
