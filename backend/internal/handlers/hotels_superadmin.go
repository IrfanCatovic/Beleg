package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/slug"

	"github.com/gin-gonic/gin"
)

func validateHotelCoords(lat, lng float64) string {
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return "Koordinate nisu u dozvoljenom opsegu (lat −90…90, lng −180…180)."
	}
	return ""
}

type superadminHotelBody struct {
	Naziv        string   `json:"naziv"`
	Lat          float64  `json:"lat"`
	Lng          float64  `json:"lng"`
	Opis         string   `json:"opis"`
	Telefon      string   `json:"telefon"`
	Status       string   `json:"status"`
	Slike        []string `json:"slike"`
	BookingUrl   string   `json:"bookingUrl"`
	InstagramUrl string   `json:"instagramUrl"`
}

// SuperadminListHotels GET /api/superadmin/hotels
func SuperadminListHotels(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := DB(c)
	var rows []models.Hotel
	if err := db.Order("naziv ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju hotela"})
		return
	}
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, hotelToMap(&rows[i]))
	}
	c.JSON(http.StatusOK, gin.H{"hotels": out})
}

// SuperadminGetHotel GET /api/superadmin/hotels/:id
func SuperadminGetHotel(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := DB(c)
	var h models.Hotel
	if err := db.First(&h, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hotel nije pronađen"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"hotel": hotelToMap(&h)})
}

// SuperadminCreateHotel POST /api/superadmin/hotels
func SuperadminCreateHotel(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	var body superadminHotelBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	naziv := strings.TrimSpace(body.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv je obavezan"})
		return
	}
	if msg := validateHotelCoords(body.Lat, body.Lng); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	st := strings.TrimSpace(strings.ToLower(body.Status))
	if st == "" {
		st = "active"
	}
	if st != "active" && st != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status mora biti active ili draft"})
		return
	}
	db := DB(c)
	slugStr, err := slug.UniqueHotelSlug(db, naziv, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju slug-a"})
		return
	}
	h := models.Hotel{
		Naziv:        naziv,
		Slug:         slugStr,
		Lat:          body.Lat,
		Lng:          body.Lng,
		Opis:         strings.TrimSpace(body.Opis),
		Telefon:      strings.TrimSpace(body.Telefon),
		Status:       st,
		SlikeJSON:    marshalHotelSlikeJSON(body.Slike),
		BookingURL:   strings.TrimSpace(body.BookingUrl),
		InstagramURL: strings.TrimSpace(body.InstagramUrl),
	}
	if err := db.Create(&h).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Greška pri čuvanju (slug jedinstven?)"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"hotel": hotelToMap(&h)})
}

// SuperadminUpdateHotel PUT /api/superadmin/hotels/:id
func SuperadminUpdateHotel(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	var body superadminHotelBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	naziv := strings.TrimSpace(body.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv je obavezan"})
		return
	}
	if msg := validateHotelCoords(body.Lat, body.Lng); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	st := strings.TrimSpace(strings.ToLower(body.Status))
	if st == "" {
		st = "active"
	}
	if st != "active" && st != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status mora biti active ili draft"})
		return
	}
	db := DB(c)
	var h models.Hotel
	if err := db.First(&h, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hotel nije pronađen"})
		return
	}
	prevNaziv := h.Naziv
	h.Naziv = naziv
	h.Lat = body.Lat
	h.Lng = body.Lng
	h.Opis = strings.TrimSpace(body.Opis)
	h.Adresa = ""
	h.Telefon = strings.TrimSpace(body.Telefon)
	h.Status = st
	h.SlikeJSON = marshalHotelSlikeJSON(body.Slike)
	h.BookingURL = strings.TrimSpace(body.BookingUrl)
	h.InstagramURL = strings.TrimSpace(body.InstagramUrl)
	if strings.TrimSpace(prevNaziv) != naziv {
		slugStr, err := slug.UniqueHotelSlug(db, naziv, uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju slug-a"})
			return
		}
		h.Slug = slugStr
	}
	if err := db.Save(&h).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Greška pri čuvanju (slug jedinstven?)"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"hotel": hotelToMap(&h)})
}

// SuperadminDeleteHotel DELETE /api/superadmin/hotels/:id
func SuperadminDeleteHotel(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := DB(c)
	res := db.Delete(&models.Hotel{}, id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Brisanje nije uspelo"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hotel nije pronađen"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// SuperadminUploadHotelGalleryDraft POST /api/superadmin/hotels/gallery-draft — upload pre kreiranja hotela (multipart polje "slika").
func SuperadminUploadHotelGalleryDraft(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	url, ok := uploadCatalogSlikaMultipart(c, fmt.Sprintf("hotels/new-gallery-%d", time.Now().UnixNano()), helpers.CloudinaryFolderHotels())
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// SuperadminUploadHotelGallery POST /api/superadmin/hotels/:id/gallery
func SuperadminUploadHotelGallery(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := DB(c)
	var cnt int64
	db.Model(&models.Hotel{}).Where("id = ?", id).Count(&cnt)
	if cnt == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hotel nije pronađen"})
		return
	}
	url, ok := uploadCatalogSlikaMultipart(c, fmt.Sprintf("hotels/%d/gallery-%d", id, time.Now().UnixNano()), helpers.CloudinaryFolderHotels())
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}
