package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func ListFerratas(c *gin.Context) {
	db := DB(c)
	search := strings.TrimSpace(strings.ToLower(c.Query("search")))
	tezinaFilter := strings.TrimSpace(c.Query("tezina"))

	q := db.Model(&models.Ferrata{}).Where("status = ?", "active")
	if search != "" {
		pat := "%" + search + "%"
		q = q.Where("(LOWER(naziv) LIKE ? OR LOWER(drzava) LIKE ? OR LOWER(grad_opstina) LIKE ?)", pat, pat, pat)
	}
	if tezinaFilter != "" {
		q = q.Where("LOWER(tezina) = LOWER(?) OR LOWER(tezina_opcija) = LOWER(?)", tezinaFilter, tezinaFilter)
	}

	var rows []models.Ferrata
	if err := q.Order("naziv ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju ferata"})
		return
	}

	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		var cnt int64
		db.Model(&models.Akcija{}).
			Where("ferrata_id = ? AND tip_akcije = ? AND javna = ? AND is_completed = ? AND is_cancelled = ? AND start_at IS NOT NULL AND start_at > NOW()",
				rows[i].ID, "via_ferrata", true, false, false).
			Count(&cnt)
		out = append(out, ferrataToMap(&rows[i], cnt))
	}
	c.JSON(http.StatusOK, gin.H{"ferrate": out})
}

// GetFerrataBySlug GET /api/ferratas/slug/:slug
func GetFerrataBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći slug"})
		return
	}
	db := DB(c)
	var f models.Ferrata
	if err := db.Where("slug = ? AND status = ?", slug, "active").First(&f).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	var cnt int64
	db.Model(&models.Akcija{}).
		Where("ferrata_id = ? AND tip_akcije = ? AND javna = ? AND is_completed = ? AND is_cancelled = ? AND start_at IS NOT NULL AND start_at > NOW()",
			f.ID, "via_ferrata", true, false, false).
		Count(&cnt)
	c.JSON(http.StatusOK, gin.H{"ferrata": ferrataToMap(&f, cnt)})
}

// GetFerrataContactsByFerrataID GET /api/ferratas/:id/contacts
func GetFerrataContactsByFerrataID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := DB(c)
	var f models.Ferrata
	if err := db.Where("id = ? AND status = ?", id, "active").First(&f).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	var contacts []models.FerrataContact
	if err := db.Where("ferrata_id = ? AND aktivan = ?", id, true).Order("ime ASC").Find(&contacts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju kontakata"})
		return
	}
	out := make([]gin.H, 0, len(contacts))
	for i := range contacts {
		out = append(out, gin.H{
			"id":        contacts[i].ID,
			"ime":       contacts[i].Ime,
			"telefon":   contacts[i].Telefon,
			"whatsapp":  contacts[i].Whatsapp,
			"email":     contacts[i].Email,
			"napomena":  contacts[i].Napomena,
			"aktivan":   contacts[i].Aktivan,
			"createdAt": contacts[i].CreatedAt,
			"updatedAt": contacts[i].UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"contacts": out})
}

// GetFerrataUpcomingActions GET /api/ferratas/:id/upcoming-actions
func GetFerrataUpcomingActions(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := DB(c)
	var f models.Ferrata
	if err := db.Where("id = ? AND status = ?", id, "active").First(&f).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}

	var akcije []models.Akcija
	if err := db.Preload("Klub").
		Where("ferrata_id = ? AND tip_akcije = ? AND javna = ? AND is_completed = ? AND is_cancelled = ? AND start_at IS NOT NULL AND start_at > NOW()",
			id, "via_ferrata", true, false, false).
		Order("start_at ASC").
		Find(&akcije).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju akcija"})
		return
	}

	out := make([]gin.H, 0, len(akcije))
	for i := range akcije {
		var prijavljeno int64
		db.Model(&models.Prijava{}).Where("akcija_id = ? AND status = ?", akcije[i].ID, "prijavljen").Count(&prijavljeno)
		row := gin.H{
			"id":          akcije[i].ID,
			"naziv":       akcije[i].Naziv,
			"startAt":     akcije[i].StartAt,
			"maxLjudi":    akcije[i].MaxLjudi,
			"prijavljeno": prijavljeno,
		}
		if akcije[i].Klub != nil {
			row["klubNaziv"] = akcije[i].Klub.Naziv
		}
		out = append(out, row)
	}
	c.JSON(http.StatusOK, gin.H{"akcije": out})
}

// --- Superadmin ---
