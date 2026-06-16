package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/slug"

	"github.com/gin-gonic/gin"
)

type superadminPeakBody struct {
	Naziv   string   `json:"naziv"`
	Planina string   `json:"planina"`
	VisinaM int      `json:"visinaM"`
	Lat     *float64 `json:"lat"`
	Lng     *float64 `json:"lng"`
	Drzava  string   `json:"drzava"`
	Grad    string   `json:"grad"`
	Opis    string   `json:"opis"`
	Status  string   `json:"status"`
}

func validatePeakCoords(lat, lng *float64) string {
	if lat == nil && lng == nil {
		return ""
	}
	if lat == nil || lng == nil {
		return "Unesite obe koordinate (lat i lng) ili nijednu."
	}
	if *lat < -90 || *lat > 90 || *lng < -180 || *lng > 180 {
		return "Koordinate nisu u dozvoljenom opsegu (lat −90…90, lng −180…180)."
	}
	return ""
}

func normalizePeakStatus(s string) (string, bool) {
	st := strings.TrimSpace(strings.ToLower(s))
	if st == "" {
		st = "active"
	}
	if st != "active" && st != "draft" {
		return "", false
	}
	return st, true
}

// SuperadminListPeaks GET /api/superadmin/peaks
func SuperadminListPeaks(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := DB(c)
	var rows []models.Peak
	if err := db.Order("naziv_vrha ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju vrhova"})
		return
	}
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, peakToMap(&rows[i]))
	}
	c.JSON(http.StatusOK, gin.H{"peaks": out})
}

// SuperadminGetPeak GET /api/superadmin/peaks/:id
func SuperadminGetPeak(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
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

// SuperadminCreatePeak POST /api/superadmin/peaks
func SuperadminCreatePeak(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	var body superadminPeakBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	naziv := strings.TrimSpace(body.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv vrha je obavezan"})
		return
	}
	if msg := validatePeakCoords(body.Lat, body.Lng); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	st, ok := normalizePeakStatus(body.Status)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status mora biti active ili draft"})
		return
	}
	db := DB(c)
	slugStr, err := slug.UniquePeakSlug(db, naziv, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju slug-a"})
		return
	}
	p := models.Peak{
		NazivVrha: naziv,
		Planina:   strings.TrimSpace(body.Planina),
		Slug:      slugStr,
		Status:    st,
		VisinaM:   body.VisinaM,
		Lat:       body.Lat,
		Lng:       body.Lng,
		Drzava:    strings.TrimSpace(body.Drzava),
		Grad:      strings.TrimSpace(body.Grad),
		Opis:      strings.TrimSpace(body.Opis),
	}
	if err := db.Create(&p).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Greška pri čuvanju (slug jedinstven?)"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"peak": peakToMap(&p)})
}

// SuperadminUpdatePeak PUT /api/superadmin/peaks/:id
func SuperadminUpdatePeak(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	var body superadminPeakBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	naziv := strings.TrimSpace(body.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv vrha je obavezan"})
		return
	}
	if msg := validatePeakCoords(body.Lat, body.Lng); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	st, ok := normalizePeakStatus(body.Status)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status mora biti active ili draft"})
		return
	}
	db := DB(c)
	var p models.Peak
	if err := db.First(&p, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Vrh nije pronađen"})
		return
	}
	prevNaziv := p.NazivVrha
	p.NazivVrha = naziv
	p.Planina = strings.TrimSpace(body.Planina)
	p.Status = st
	p.VisinaM = body.VisinaM
	p.Lat = body.Lat
	p.Lng = body.Lng
	p.Drzava = strings.TrimSpace(body.Drzava)
	p.Grad = strings.TrimSpace(body.Grad)
	p.Opis = strings.TrimSpace(body.Opis)
	if strings.TrimSpace(prevNaziv) != naziv {
		slugStr, err := slug.UniquePeakSlug(db, naziv, uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju slug-a"})
			return
		}
		p.Slug = slugStr
	}
	if err := db.Save(&p).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Greška pri čuvanju (slug jedinstven?)"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"peak": peakToMap(&p)})
}

// SuperadminDeletePeak DELETE /api/superadmin/peaks/:id
func SuperadminDeletePeak(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := DB(c)
	res := db.Delete(&models.Peak{}, id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Brisanje nije uspelo"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Vrh nije pronađen"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
