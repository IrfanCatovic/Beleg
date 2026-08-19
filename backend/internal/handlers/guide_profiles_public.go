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
	"gorm.io/gorm"
)

type guideWithDist struct {
	gp *models.GuideProfile
	k  *models.Korisnik
	km float64
}

func guideNearbyToPublicDTO(gp *models.GuideProfile, k *models.Korisnik, tourTypes []string, distanceKm *float64) gin.H {
	jezici := parseJeziciJSON(gp.JeziciJSON)
	resp := gin.H{
		"id":               gp.ID,
		"naslov":           gp.Naslov,
		"opis":             gp.Opis,
		"grad":             gp.Grad,
		"region":           gp.Region,
		"drzava":           gp.Drzava,
		"jezici":           jezici,
		"tourTypes":        tourTypes,
		"prosecnaOcena":    gp.ProsecnaOcena,
		"brojOcena":        gp.BrojOcena,
		"brojVodjenihTura": gp.BrojVodjenihTura,
	}
	if distanceKm != nil {
		resp["distanceKm"] = math.Round(*distanceKm*100) / 100
	}
	if gp.BaseLat != nil {
		resp["baseLat"] = *gp.BaseLat
	}
	if gp.BaseLng != nil {
		resp["baseLng"] = *gp.BaseLng
	}
	if k != nil {
		// Public nested user: bez telefona/emaila/privatnih polja.
		resp["user"] = gin.H{
			"id":        k.ID,
			"username":  k.Username,
			"fullName":  k.FullName,
			"avatarUrl": k.AvatarURL,
		}
	}
	return resp
}

func guideHasTourType(db *gorm.DB, profileID uint, tourType string) bool {
	var n int64
	db.Model(&models.GuideTourType{}).Where("guide_profile_id = ? AND type = ?", profileID, tourType).Count(&n)
	return n > 0
}

// ListGuidesNearby GET /api/guides/nearby?lat=&lng=&radius_km=&limit=&tour_type=
func ListGuidesNearby(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil || strings.TrimSpace(latStr) == "" || strings.TrimSpace(lngStr) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parametri lat i lng su obavezni i moraju biti brojevi."})
		return
	}
	if !geo.ValidLatLng(lat, lng) {
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
	tourType := strings.TrimSpace(strings.ToLower(c.Query("tour_type")))
	if tourType != "" && !models.AllowedGuideTourTypes[tourType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći tip ture"})
		return
	}

	db := DB(c)
	var rows []models.GuideProfile
	if err := db.Where("status = ? AND base_lat IS NOT NULL AND base_lng IS NOT NULL", models.GuideStatusApproved).
		Preload("Korisnik").
		Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju vodiča"})
		return
	}

	list := make([]guideWithDist, 0)
	for i := range rows {
		gp := &rows[i]
		if gp.BaseLat == nil || gp.BaseLng == nil {
			continue
		}
		if tourType != "" && !guideHasTourType(db, gp.ID, tourType) {
			continue
		}
		d := geo.DistanceKmHaversine(lat, lng, *gp.BaseLat, *gp.BaseLng)
		if d <= radiusKm {
			k := gp.Korisnik
			list = append(list, guideWithDist{gp: gp, k: &k, km: d})
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].km < list[j].km })
	if len(list) > limit {
		list = list[:limit]
	}

	out := make([]gin.H, 0, len(list))
	for _, x := range list {
		types, _ := loadTourTypeStrings(db, x.gp.ID)
		km := x.km
		out = append(out, guideNearbyToPublicDTO(x.gp, x.k, types, &km))
	}
	c.JSON(http.StatusOK, gin.H{"guides": out})
}

var guideCatalogMountainTypes = []string{
	models.GuideTourPlaninarska,
	models.GuideTourUsponNaVrh,
	models.GuideTourVisokogorska,
	models.GuideTourZimska,
	models.GuideTourAlpinisticka,
	models.GuideTourVisednevna,
	models.GuideTourPorodicna,
	models.GuideTourPrivatna,
	models.GuideTourEdukativna,
}

func guideMatchesCatalogCategory(db *gorm.DB, profileID uint, category string) bool {
	switch category {
	case "ferrata":
		return guideHasTourType(db, profileID, models.GuideTourViaFerrata)
	case "planine":
		for _, tt := range guideCatalogMountainTypes {
			if guideHasTourType(db, profileID, tt) {
				return true
			}
		}
		return false
	default:
		return true
	}
}

func guideCatalogSortKey(gp *models.GuideProfile) (float64, int, string) {
	return gp.ProsecnaOcena, gp.BrojVodjenihTura, strings.TrimSpace(gp.Naslov)
}

// ListGuidesCatalog GET /api/guides?category=all|ferrata|planine&limit=
func ListGuidesCatalog(c *gin.Context) {
	category := strings.TrimSpace(strings.ToLower(c.Query("category")))
	if category == "" {
		category = "all"
	}
	if category != "all" && category != "ferrata" && category != "planine" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća kategorija"})
		return
	}
	limit := 100
	if n, err := strconv.Atoi(c.Query("limit")); err == nil && n > 0 {
		if n > 200 {
			limit = 200
		} else {
			limit = n
		}
	}

	db := DB(c)
	var rows []models.GuideProfile
	if err := db.Where("status = ?", models.GuideStatusApproved).
		Preload("Korisnik").
		Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju vodiča"})
		return
	}

	filtered := make([]*models.GuideProfile, 0, len(rows))
	for i := range rows {
		gp := &rows[i]
		if !guideMatchesCatalogCategory(db, gp.ID, category) {
			continue
		}
		filtered = append(filtered, gp)
	}
	sort.Slice(filtered, func(i, j int) bool {
		ai, ti, ni := guideCatalogSortKey(filtered[i])
		aj, tj, nj := guideCatalogSortKey(filtered[j])
		if ai != aj {
			return ai > aj
		}
		if ti != tj {
			return ti > tj
		}
		return strings.ToLower(ni) < strings.ToLower(nj)
	})
	originLat, originLng, hasOrigin := parseOptionalGuideOrigin(c)

	type catalogItem struct {
		gp *models.GuideProfile
		km *float64
	}
	items := make([]catalogItem, 0, len(filtered))
	for _, gp := range filtered {
		var kmPtr *float64
		if hasOrigin && gp.BaseLat != nil && gp.BaseLng != nil && geo.ValidLatLng(*gp.BaseLat, *gp.BaseLng) {
			d := geo.DistanceKmHaversine(originLat, originLng, *gp.BaseLat, *gp.BaseLng)
			kmPtr = &d
		}
		items = append(items, catalogItem{gp: gp, km: kmPtr})
	}

	if hasOrigin {
		sort.SliceStable(items, func(i, j int) bool {
			ai, aj := items[i].km, items[j].km
			if ai != nil && aj != nil {
				return *ai < *aj
			}
			if ai != nil && aj == nil {
				return true
			}
			if ai == nil && aj != nil {
				return false
			}
			return false
		})
	}
	if len(items) > limit {
		items = items[:limit]
	}

	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		k := it.gp.Korisnik
		types, _ := loadTourTypeStrings(db, it.gp.ID)
		out = append(out, guideNearbyToPublicDTO(it.gp, &k, types, it.km))
	}
	c.JSON(http.StatusOK, gin.H{"guides": out})
}

func parseOptionalGuideOrigin(c *gin.Context) (lat, lng float64, ok bool) {
	latStr := strings.TrimSpace(c.Query("lat"))
	lngStr := strings.TrimSpace(c.Query("lng"))
	if latStr == "" || lngStr == "" {
		return 0, 0, false
	}
	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil || !geo.ValidLatLng(lat, lng) {
		return 0, 0, false
	}
	return lat, lng, true
}
