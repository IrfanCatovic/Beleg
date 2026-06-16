package handlers

import (
	"net/http"
	"strconv"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func peakToMap(p *models.Peak) gin.H {
	m := gin.H{
		"id":        p.ID,
		"naziv":     p.NazivVrha,
		"planina":   p.Planina,
		"slug":      p.Slug,
		"status":    p.Status,
		"visinaM":   p.VisinaM,
		"drzava":    p.Drzava,
		"grad":      p.Grad,
		"opis":      p.Opis,
		"createdAt": p.CreatedAt,
		"updatedAt": p.UpdatedAt,
	}
	if p.Lat != nil {
		m["lat"] = *p.Lat
	} else {
		m["lat"] = nil
	}
	if p.Lng != nil {
		m["lng"] = *p.Lng
	} else {
		m["lng"] = nil
	}
	return m
}

// ListPeaks GET /api/peaks — svi aktivni vrhovi (za prikaz pinova na mapi).
func ListPeaks(c *gin.Context) {
	db := DB(c)
	var rows []models.Peak
	if err := db.Where("status = ?", "active").Order("naziv_vrha ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju vrhova"})
		return
	}
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, peakToMap(&rows[i]))
	}
	c.JSON(http.StatusOK, gin.H{"peaks": out})
}

// GetPeakByID GET /api/peaks/:id — jedan vrh (za prefill forme akcije).
func GetPeakByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := DB(c)
	var p models.Peak
	if err := db.First(&p, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Vrh nije pronađen"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"peak": peakToMap(&p)})
}
