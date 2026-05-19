package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type nominatimHit struct {
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
	DisplayName string `json:"display_name"`
}

// GetGeocodeSearch GET /api/geocode?q= — proxy ka Nominatim-u (OpenStreetMap) radi pretrage mjesta/planina u formi.
func GetGeocodeSearch(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if len(q) < 3 || len(q) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Upit za lokaciju: 3–200 karaktera."})
		return
	}
	endpoint := "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + url.QueryEscape(q)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri pripremi zahtjeva."})
		return
	}
	req.Header.Set("User-Agent", "BelegMountaineeringApp/1.0")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Servis lokacije trenutno nije dostupan."})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Geokodiranje nije uspjelo."})
		return
	}
	var hits []nominatimHit
	if err := json.NewDecoder(resp.Body).Decode(&hits); err != nil || len(hits) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Nema rezultata za ovaj upit."})
		return
	}
	h := hits[0]
	lat, e1 := strconv.ParseFloat(h.Lat, 64)
	lng, e2 := strconv.ParseFloat(h.Lon, 64)
	if e1 != nil || e2 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nepoznat format odgovora servisa."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"lat": lat, "lng": lng, "displayName": h.DisplayName})
}
