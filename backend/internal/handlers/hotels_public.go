package handlers

import (
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"beleg-app/backend/internal/geo"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type hotelWithDist struct {
	h  models.Hotel
	km float64
}

// ListHotelsAll GET /api/hotels — svi aktivni hoteli (za prikaz pinova na mapi).
func ListHotelsAll(c *gin.Context) {
	db := DB(c)
	var rows []models.Hotel
	if err := db.Where("status = ?", "active").Order("naziv ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju hotela"})
		return
	}
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, hotelToMap(&rows[i]))
	}
	c.JSON(http.StatusOK, gin.H{"hotels": out})
}

// ListHotelsNearby GET /api/hotels/nearby?lat=&lng=&radius_km=&limit=
func ListHotelsNearby(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil || strings.TrimSpace(latStr) == "" || strings.TrimSpace(lngStr) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parametri lat i lng su obavezni i moraju biti brojevi."})
		return
	}
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Koordinate nisu u dozvoljenom opsegu."})
		return
	}

	radiusKm := 100.0
	if r := parsePositiveFloat(c.Query("radius_km")); r > 0 && r <= 500 {
		radiusKm = r
	}
	limit := 25
	if n, err := strconv.Atoi(c.Query("limit")); err == nil && n > 0 {
		if n > 50 {
			limit = 50
		} else {
			limit = n
		}
	}

	db := DB(c)
	var rows []models.Hotel
	if err := db.Where("status = ?", "active").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju hotela"})
		return
	}

	list := make([]hotelWithDist, 0, len(rows))
	for i := range rows {
		d := geo.DistanceKmHaversine(lat, lng, rows[i].Lat, rows[i].Lng)
		if d <= radiusKm {
			list = append(list, hotelWithDist{h: rows[i], km: d})
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].km < list[j].km })
	if len(list) > limit {
		list = list[:limit]
	}

	out := make([]gin.H, 0, len(list))
	for _, x := range list {
		m := hotelToMap(&x.h)
		m["distanceKm"] = math.Round(x.km*100) / 100
		out = append(out, m)
	}
	c.JSON(http.StatusOK, gin.H{"hotels": out})
}

func parsePositiveFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}
