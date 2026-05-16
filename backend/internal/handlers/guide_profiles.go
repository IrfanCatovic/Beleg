package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type guideApplyBody struct {
	Naslov          string   `json:"naslov"`
	Opis            string   `json:"opis"`
	Drzava          string   `json:"drzava"`
	Region          string   `json:"region"`
	Grad            string   `json:"grad"`
	BaseLat         float64  `json:"baseLat"`
	BaseLng         float64  `json:"baseLng"`
	GodineIskustva  int      `json:"godineIskustva"`
	Jezici          []string `json:"jezici"`
	SertifikatiOpis string   `json:"sertifikatiOpis"`
	TourTypes       []string `json:"tourTypes"`
	Telefon         string   `json:"telefon"`
}

type guideRejectBody struct {
	RazlogOdbijanja string `json:"razlogOdbijanja"`
}

func currentKorisnik(c *gin.Context, db *gorm.DB) (*models.Korisnik, bool) {
	username, ok := c.Get("username")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return nil, false
	}
	var k models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&k).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return nil, false
	}
	return &k, true
}

func marshalJezici(jezici []string) json.RawMessage {
	filtered := make([]string, 0, len(jezici))
	for _, j := range jezici {
		j = strings.TrimSpace(j)
		if j != "" {
			filtered = append(filtered, j)
		}
	}
	if len(filtered) == 0 {
		return json.RawMessage("[]")
	}
	b, _ := json.Marshal(filtered)
	return b
}

func parseJeziciJSON(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return []string{}
	}
	return out
}

func validateGuideApplyBody(body guideApplyBody, telefonOnUser string) (string, bool) {
	naslov := strings.TrimSpace(body.Naslov)
	if naslov == "" {
		return "Naslov profila je obavezan", false
	}
	opis := strings.TrimSpace(body.Opis)
	if len(opis) < 30 {
		return "Opis mora imati najmanje 30 karaktera", false
	}
	grad := strings.TrimSpace(body.Grad)
	region := strings.TrimSpace(body.Region)
	if grad == "" && region == "" {
		return "Grad ili region je obavezan", false
	}
	if body.BaseLat < -90 || body.BaseLat > 90 || body.BaseLng < -180 || body.BaseLng > 180 {
		return "Koordinate baze nisu u dozvoljenom opsegu", false
	}
	if body.GodineIskustva < 0 {
		return "Godine iskustva moraju biti >= 0", false
	}
	jezici := make([]string, 0)
	for _, j := range body.Jezici {
		if strings.TrimSpace(j) != "" {
			jezici = append(jezici, strings.TrimSpace(j))
		}
	}
	if len(jezici) == 0 {
		return "Izaberite bar jedan jezik", false
	}
	types := normalizeTourTypes(body.TourTypes)
	if len(types) == 0 {
		return "Izaberite bar jednu vrstu ture", false
	}
	tel := strings.TrimSpace(telefonOnUser)
	if tel == "" {
		tel = strings.TrimSpace(body.Telefon)
	}
	if tel == "" {
		return "Telefon je obavezan za vodički profil", false
	}
	return "", true
}

func normalizeTourTypes(in []string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(in))
	for _, t := range in {
		t = strings.TrimSpace(strings.ToLower(t))
		if t == "" || !models.AllowedGuideTourTypes[t] || seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
	}
	return out
}

func loadTourTypeStrings(db *gorm.DB, profileID uint) ([]string, error) {
	var rows []models.GuideTourType
	if err := db.Where("guide_profile_id = ?", profileID).Order("type ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Type)
	}
	return out, nil
}

func replaceTourTypes(tx *gorm.DB, profileID uint, types []string) error {
	if err := tx.Where("guide_profile_id = ?", profileID).Delete(&models.GuideTourType{}).Error; err != nil {
		return err
	}
	for _, t := range types {
		row := models.GuideTourType{GuideProfileID: profileID, Type: t}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func guideProfileToDTO(gp *models.GuideProfile, k *models.Korisnik, tourTypes []string, includeAdmin bool, forOwner bool) gin.H {
	jezici := parseJeziciJSON(gp.JeziciJSON)
	resp := gin.H{
		"id":               gp.ID,
		"korisnikId":       gp.KorisnikID,
		"status":           gp.Status,
		"naslov":           gp.Naslov,
		"opis":             gp.Opis,
		"drzava":           gp.Drzava,
		"region":           gp.Region,
		"grad":             gp.Grad,
		"godineIskustva":   gp.GodineIskustva,
		"jezici":           jezici,
		"sertifikatiOpis":  gp.SertifikatiOpis,
		"prosecnaOcena":    gp.ProsecnaOcena,
		"brojOcena":        gp.BrojOcena,
		"brojVodjenihTura": gp.BrojVodjenihTura,
		"tourTypes":        tourTypes,
		"createdAt":        gp.CreatedAt,
		"updatedAt":        gp.UpdatedAt,
	}
	if gp.BaseLat != nil {
		resp["baseLat"] = *gp.BaseLat
	}
	if gp.BaseLng != nil {
		resp["baseLng"] = *gp.BaseLng
	}
	if k != nil {
		userDTO := gin.H{
			"id":        k.ID,
			"username":  k.Username,
			"fullName":  k.FullName,
			"email":     k.Email,
			"avatarUrl": k.AvatarURL,
		}
		if forOwner || gp.Status == models.GuideStatusApproved {
			userDTO["telefon"] = k.Telefon
		}
		resp["user"] = userDTO
	}
	if includeAdmin {
		resp["adminNapomena"] = gp.AdminNapomena
		resp["razlogOdbijanja"] = gp.RazlogOdbijanja
		resp["approvedBy"] = gp.ApprovedBy
		resp["approvedAt"] = gp.ApprovedAt
	} else if forOwner && gp.Status == models.GuideStatusRejected {
		resp["razlogOdbijanja"] = gp.RazlogOdbijanja
	}
	return resp
}

func buildGuideProfileFromBody(body guideApplyBody) models.GuideProfile {
	lat := body.BaseLat
	lng := body.BaseLng
	return models.GuideProfile{
		Status:          models.GuideStatusPending,
		Naslov:          strings.TrimSpace(body.Naslov),
		Opis:            strings.TrimSpace(body.Opis),
		Drzava:          strings.TrimSpace(body.Drzava),
		Region:          strings.TrimSpace(body.Region),
		Grad:            strings.TrimSpace(body.Grad),
		BaseLat:         &lat,
		BaseLng:         &lng,
		GodineIskustva:  body.GodineIskustva,
		JeziciJSON:      marshalJezici(body.Jezici),
		SertifikatiOpis: strings.TrimSpace(body.SertifikatiOpis),
	}
}

// ApplyGuideProfile POST /api/guide-profiles/apply
func ApplyGuideProfile(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	k, ok := currentKorisnik(c, db)
	if !ok {
		return
	}
	var existing models.GuideProfile
	err := db.Where("korisnik_id = ?", k.ID).First(&existing).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Već imate vodički profil"})
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri profila"})
		return
	}

	var body guideApplyBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}

	telefonUser := strings.TrimSpace(k.Telefon)
	if telefonUser == "" && strings.TrimSpace(body.Telefon) != "" {
		if err := db.Model(k).Update("telefon", strings.TrimSpace(body.Telefon)).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju telefona"})
			return
		}
		k.Telefon = strings.TrimSpace(body.Telefon)
		telefonUser = k.Telefon
	}

	if msg, ok := validateGuideApplyBody(body, telefonUser); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	types := normalizeTourTypes(body.TourTypes)

	profile := buildGuideProfileFromBody(body)
	profile.KorisnikID = k.ID

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&profile).Error; err != nil {
			return err
		}
		return replaceTourTypes(tx, profile.ID, types)
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju zahteva"})
		return
	}

	typesLoaded, _ := loadTourTypeStrings(db, profile.ID)
	c.JSON(http.StatusCreated, gin.H{
		"message":      "Tvoj zahtev za vodiča je poslat i čeka odobrenje.",
		"guideProfile": guideProfileToDTO(&profile, k, typesLoaded, false, true),
	})
}

// GetMyGuideProfile GET /api/me/guide-profile
func GetMyGuideProfile(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	k, ok := currentKorisnik(c, db)
	if !ok {
		return
	}
	var gp models.GuideProfile
	if err := db.Where("korisnik_id = ?", k.ID).First(&gp).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"guideProfile": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju profila"})
		return
	}
	types, _ := loadTourTypeStrings(db, gp.ID)
	c.JSON(http.StatusOK, gin.H{"guideProfile": guideProfileToDTO(&gp, k, types, false, true)})
}

// UpdateMyGuideProfile PUT /api/me/guide-profile
func UpdateMyGuideProfile(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	k, ok := currentKorisnik(c, db)
	if !ok {
		return
	}
	var gp models.GuideProfile
	if err := db.Where("korisnik_id = ?", k.ID).First(&gp).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Nemate vodički profil"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju profila"})
		return
	}
	if gp.Status != models.GuideStatusPending && gp.Status != models.GuideStatusRejected {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Profil se može menjati samo dok je na čekanju ili odbijen"})
		return
	}

	var body guideApplyBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}

	telefonUser := strings.TrimSpace(k.Telefon)
	if telefonUser == "" && strings.TrimSpace(body.Telefon) != "" {
		if err := db.Model(k).Update("telefon", strings.TrimSpace(body.Telefon)).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju telefona"})
			return
		}
		k.Telefon = strings.TrimSpace(body.Telefon)
		telefonUser = k.Telefon
	}

	if msg, ok := validateGuideApplyBody(body, telefonUser); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	types := normalizeTourTypes(body.TourTypes)

	updated := buildGuideProfileFromBody(body)
	updated.ID = gp.ID
	updated.KorisnikID = gp.KorisnikID
	updated.Status = models.GuideStatusPending
	updated.RazlogOdbijanja = ""
	updated.ApprovedBy = nil
	updated.ApprovedAt = nil
	updated.ProsecnaOcena = gp.ProsecnaOcena
	updated.BrojOcena = gp.BrojOcena
	updated.BrojVodjenihTura = gp.BrojVodjenihTura
	updated.AdminNapomena = gp.AdminNapomena
	updated.CreatedAt = gp.CreatedAt

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&updated).Error; err != nil {
			return err
		}
		return replaceTourTypes(tx, updated.ID, types)
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju profila"})
		return
	}

	typesLoaded, _ := loadTourTypeStrings(db, updated.ID)
	c.JSON(http.StatusOK, gin.H{
		"message":      "Zahtev je ažuriran i ponovo poslat na odobrenje.",
		"guideProfile": guideProfileToDTO(&updated, k, typesLoaded, false, true),
	})
}

func loadGuideProfileAdminList(db *gorm.DB, statusFilter string) ([]gin.H, error) {
	q := db.Model(&models.GuideProfile{}).Preload("Korisnik").Order("created_at DESC")
	if statusFilter != "" {
		q = q.Where("status = ?", statusFilter)
	}
	var rows []models.GuideProfile
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		types, _ := loadTourTypeStrings(db, rows[i].ID)
		k := rows[i].Korisnik
		out = append(out, guideProfileToDTO(&rows[i], &k, types, true, false))
	}
	return out, nil
}

// SuperadminListGuideProfiles GET /api/superadmin/guide-profiles
func SuperadminListGuideProfiles(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	status := strings.TrimSpace(c.Query("status"))
	list, err := loadGuideProfileAdminList(db, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju liste"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"guideProfiles": list})
}

// SuperadminListPendingGuideProfiles GET /api/superadmin/guide-profiles/pending
func SuperadminListPendingGuideProfiles(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	list, err := loadGuideProfileAdminList(db, models.GuideStatusPending)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju liste"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"guideProfiles": list})
}

func superadminGetGuideByID(c *gin.Context, db *gorm.DB) (*models.GuideProfile, *models.Korisnik, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return nil, nil, false
	}
	var gp models.GuideProfile
	if err := db.Preload("Korisnik").First(&gp, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Profil nije pronađen"})
			return nil, nil, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju profila"})
		return nil, nil, false
	}
	return &gp, &gp.Korisnik, true
}

// SuperadminApproveGuideProfile PUT /api/superadmin/guide-profiles/:id/approve
func SuperadminApproveGuideProfile(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	admin, ok := currentKorisnik(c, db)
	if !ok {
		return
	}
	gp, k, ok := superadminGetGuideByID(c, db)
	if !ok {
		return
	}
	now := time.Now()
	aid := admin.ID
	updates := map[string]interface{}{
		"status":           models.GuideStatusApproved,
		"approved_by":      aid,
		"approved_at":      now,
		"razlog_odbijanja": "",
	}
	if err := db.Model(gp).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri odobravanju"})
		return
	}
	gp.Status = models.GuideStatusApproved
	gp.ApprovedBy = &aid
	gp.ApprovedAt = &now
	gp.RazlogOdbijanja = ""
	types, _ := loadTourTypeStrings(db, gp.ID)
	c.JSON(http.StatusOK, gin.H{
		"message":      "Vodič je odobren.",
		"guideProfile": guideProfileToDTO(gp, k, types, true, false),
	})
}

// SuperadminRejectGuideProfile PUT /api/superadmin/guide-profiles/:id/reject
func SuperadminRejectGuideProfile(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	gp, k, ok := superadminGetGuideByID(c, db)
	if !ok {
		return
	}
	var body guideRejectBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	razlog := strings.TrimSpace(body.RazlogOdbijanja)
	if razlog == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Razlog odbijanja je obavezan"})
		return
	}
	if err := db.Model(gp).Updates(map[string]interface{}{
		"status":           models.GuideStatusRejected,
		"razlog_odbijanja": razlog,
		"approved_by":      nil,
		"approved_at":      nil,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri odbijanju"})
		return
	}
	gp.Status = models.GuideStatusRejected
	gp.RazlogOdbijanja = razlog
	types, _ := loadTourTypeStrings(db, gp.ID)
	c.JSON(http.StatusOK, gin.H{
		"message":      "Zahtev je odbijen.",
		"guideProfile": guideProfileToDTO(gp, k, types, true, false),
	})
}

// SuperadminSuspendGuideProfile PUT /api/superadmin/guide-profiles/:id/suspend
func SuperadminSuspendGuideProfile(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	gp, k, ok := superadminGetGuideByID(c, db)
	if !ok {
		return
	}
	if err := db.Model(gp).Update("status", models.GuideStatusSuspended).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri suspendovanju"})
		return
	}
	gp.Status = models.GuideStatusSuspended
	types, _ := loadTourTypeStrings(db, gp.ID)
	c.JSON(http.StatusOK, gin.H{
		"message":      "Vodič je suspendovan.",
		"guideProfile": guideProfileToDTO(gp, k, types, true, false),
	})
}
