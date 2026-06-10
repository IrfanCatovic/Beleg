package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/slug"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ferrataSnapshotPayload struct {
	Naziv              string   `json:"naziv"`
	Lokacija           string   `json:"lokacija"`
	Tezina             string   `json:"tezina"`
	TezinaOpcija       string   `json:"tezina_opcija"`
	DuzinaM            int      `json:"duzina_m"`
	VisinskaRazlikaM   int      `json:"visinska_razlika_m"`
	PrilazMin          int      `json:"prilaz_min"`
	TrajanjeMin        int      `json:"trajanje_min"`
	TrajanjeMax        int      `json:"trajanje_max"`
	PogodnoZaPocetnike string   `json:"pogodno_za_pocetnike"`
	ObaveznaOprema     []string `json:"obavezna_oprema"`
	Lat                *float64 `json:"lat,omitempty"`
	Lng                *float64 `json:"lng,omitempty"`
}

type ferrataOpremaItem struct {
	Label string `json:"label"`
	Icon  string `json:"icon"`
}

func displayFerrataRegion(f *models.Ferrata) string {
	a := strings.TrimSpace(f.GradOpstina)
	b := strings.TrimSpace(f.Drzava)
	if a != "" && b != "" {
		return a + ", " + b
	}
	if a != "" {
		return a
	}
	return b
}

func parseStringSliceJSON(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return []string{}
	}
	return out
}

func marshalGalleryJSON(urls []string) json.RawMessage {
	filtered := make([]string, 0, len(urls))
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u != "" {
			filtered = append(filtered, u)
		}
	}
	b, _ := json.Marshal(filtered)
	return json.RawMessage(b)
}

func buildFerrataSnapshotBytes(f *models.Ferrata) ([]byte, error) {
	labels := obaveznaOpremaLabels(f.ObaveznaOpremaJSON)
	p := ferrataSnapshotPayload{
		Naziv:              f.Naziv,
		Lokacija:           displayFerrataRegion(f),
		Tezina:             f.Tezina,
		TezinaOpcija:       f.TezinaOpcija,
		DuzinaM:            f.DuzinaM,
		VisinskaRazlikaM:   f.VisinskaRazlikaM,
		PrilazMin:          f.PrilazMin,
		TrajanjeMin:        f.TrajanjeMin,
		TrajanjeMax:        f.TrajanjeMax,
		PogodnoZaPocetnike: f.PogodnoZaPocetnike,
		ObaveznaOprema:     labels,
		Lat:                f.Lat,
		Lng:                f.Lng,
	}
	return json.Marshal(p)
}

func obaveznaOpremaLabels(raw json.RawMessage) []string {
	items := parseObaveznaOpremaItems(raw)
	out := make([]string, 0, len(items))
	for _, it := range items {
		if strings.TrimSpace(it.Label) != "" {
			out = append(out, strings.TrimSpace(it.Label))
		}
	}
	return out
}

func parseObaveznaOpremaItems(raw json.RawMessage) []ferrataOpremaItem {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var objs []ferrataOpremaItem
	if err := json.Unmarshal(raw, &objs); err == nil && len(objs) > 0 {
		// Novi format [{label, icon}, ...] ili prazan objekat
		if len(objs) > 1 || strings.TrimSpace(objs[0].Label) != "" || strings.TrimSpace(objs[0].Icon) != "" {
			return objs
		}
	}
	var strs []string
	if err := json.Unmarshal(raw, &strs); err == nil {
		out := make([]ferrataOpremaItem, 0, len(strs))
		for _, s := range strs {
			s = strings.TrimSpace(s)
			if s != "" {
				out = append(out, ferrataOpremaItem{Label: s})
			}
		}
		return out
	}
	return nil
}

func marshalObaveznaOpremaJSON(items []ferrataOpremaItem) json.RawMessage {
	filtered := make([]ferrataOpremaItem, 0, len(items))
	for _, it := range items {
		if strings.TrimSpace(it.Label) == "" {
			continue
		}
		filtered = append(filtered, ferrataOpremaItem{Label: strings.TrimSpace(it.Label), Icon: strings.TrimSpace(it.Icon)})
	}
	b, _ := json.Marshal(filtered)
	return json.RawMessage(b)
}

func obaveznaOpremaForAPI(raw json.RawMessage) []gin.H {
	items := parseObaveznaOpremaItems(raw)
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		if strings.TrimSpace(it.Label) == "" {
			continue
		}
		out = append(out, gin.H{"label": it.Label, "icon": strings.TrimSpace(it.Icon)})
	}
	return out
}

// Smeštaj u katalogu ferate više nije u upotrebi (hoteli + udaljenost); kolona ostaje u bazi.
var ferrataSmestajJSONEmpty = json.RawMessage([]byte("[]"))

func ferrataCoordJSON(v *float64) interface{} {
	if v == nil {
		return nil
	}
	return *v
}

// validateFerrataLatLngRequired glavna tačka ferate — potrebna za mapu i kasnije udaljenost do vodiča.
func validateFerrataLatLngRequired(lat, lng *float64) error {
	if lat == nil || lng == nil {
		return fmt.Errorf("Koordinate ferate (lat i lng) su obavezne")
	}
	if math.IsNaN(*lat) || math.IsInf(*lat, 0) || math.IsNaN(*lng) || math.IsInf(*lng, 0) {
		return fmt.Errorf("Koordinate nisu validne")
	}
	if *lat < -90 || *lat > 90 {
		return fmt.Errorf("Geografska širina (lat) mora biti između -90 i 90")
	}
	if *lng < -180 || *lng > 180 {
		return fmt.Errorf("Geografska dužina (lng) mora biti između -180 i 180")
	}
	return nil
}

func ferrataToMap(f *models.Ferrata, upcoming int64) gin.H {
	m := gin.H{
		"id":               f.ID,
		"naziv":            f.Naziv,
		"slug":             f.Slug,
		"drzava":           f.Drzava,
		"gradOpstina":      f.GradOpstina,
		"podrucje":         displayFerrataRegion(f),
		"opis":             f.Opis,
		"tezina":           f.Tezina,
		"tezinaOpcija":     f.TezinaOpcija,
		"duzinaM":          f.DuzinaM,
		"visinskaRazlikaM": f.VisinskaRazlikaM,
		"trajanjeMin":      f.TrajanjeMin,
		"trajanjeMax":      f.TrajanjeMax,
		"quickTip":         f.QuickTip,
		"lat":              ferrataCoordJSON(f.Lat),
		"lng":              ferrataCoordJSON(f.Lng),
		"highlights":       parseStringSliceJSON(f.HighlightsJSON),
		"okolina":          parseStringSliceJSON(f.OkolinaJSON),
		"galerija":         parseStringSliceJSON(f.GalerijaJSON),
		"obaveznaOprema":   obaveznaOpremaForAPI(f.ObaveznaOpremaJSON),
		"coverImage":       f.CoverImage,
		"mapNote":          strings.TrimSpace(f.MapNote),
		"status":           f.Status,
		"createdAt":        f.CreatedAt,
		"updatedAt":        f.UpdatedAt,
	}
	if upcoming >= 0 {
		m["upcomingActionsCount"] = upcoming
	}
	return m
}

// ListFerratas GET /api/ferratas — samo active za javnost.
func ListFerratas(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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
			Where("ferrata_id = ? AND tip_akcije = ? AND javna = ? AND is_completed = ? AND start_at IS NOT NULL AND start_at > NOW()",
				rows[i].ID, "via_ferrata", true, false).
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
	db := c.MustGet("db").(*gorm.DB)
	var f models.Ferrata
	if err := db.Where("slug = ? AND status = ?", slug, "active").First(&f).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	var cnt int64
	db.Model(&models.Akcija{}).
		Where("ferrata_id = ? AND tip_akcije = ? AND javna = ? AND is_completed = ? AND start_at IS NOT NULL AND start_at > NOW()",
			f.ID, "via_ferrata", true, false).
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
	db := c.MustGet("db").(*gorm.DB)
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
	db := c.MustGet("db").(*gorm.DB)
	var f models.Ferrata
	if err := db.Where("id = ? AND status = ?", id, "active").First(&f).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}

	var akcije []models.Akcija
	if err := db.Preload("Klub").
		Where("ferrata_id = ? AND tip_akcije = ? AND javna = ? AND is_completed = ? AND start_at IS NOT NULL AND start_at > NOW()",
			id, "via_ferrata", true, false).
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

func SuperadminListFerratas(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	status := strings.TrimSpace(c.Query("status"))
	q := db.Model(&models.Ferrata{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var rows []models.Ferrata
	if err := q.Order("updated_at DESC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju ferata"})
		return
	}
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, ferrataToMap(&rows[i], -1))
	}
	c.JSON(http.StatusOK, gin.H{"ferrate": out})
}

func SuperadminGetFerrata(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var f models.Ferrata
	if err := db.First(&f, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ferrata": ferrataToMap(&f, -1)})
}

type superadminFerrataBody struct {
	Naziv            string              `json:"naziv"`
	Slug             string              `json:"slug"`
	Drzava           string              `json:"drzava"`
	GradOpstina      string              `json:"gradOpstina"`
	Opis             string              `json:"opis"`
	Tezina           string              `json:"tezina"`
	TezinaOpcija     string              `json:"tezinaOpcija"`
	DuzinaM          int                 `json:"duzinaM"`
	VisinskaRazlikaM int                 `json:"visinskaRazlikaM"`
	TrajanjeMin      int                 `json:"trajanjeMin"`
	TrajanjeMax      int                 `json:"trajanjeMax"`
	QuickTip         string              `json:"quickTip"`
	Highlights       []string            `json:"highlights"`
	Okolina          []string            `json:"okolina"`
	ObaveznaOprema   []ferrataOpremaItem `json:"obaveznaOprema"`
	CoverImage       string              `json:"coverImage"`
	MapNote          string              `json:"mapNote"`
	/** Ako je izostavljeno u PUT-u, galerija u bazi se ne menja. */
	Galerija *[]string `json:"galerija,omitempty"`
	Status   string    `json:"status"`
	Lat              *float64            `json:"lat"`
	Lng              *float64            `json:"lng"`
}

func marshalJSONArray(a []string) json.RawMessage {
	if a == nil {
		a = []string{}
	}
	b, _ := json.Marshal(a)
	return json.RawMessage(b)
}

func SuperadminCreateFerrata(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	var body superadminFerrataBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	naziv := strings.TrimSpace(body.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv je obavezan"})
		return
	}
	st := strings.TrimSpace(strings.ToLower(body.Status))
	if st == "" {
		st = "active"
	}
	if st != "active" && st != "closed" && st != "archived" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status mora biti active, closed ili archived"})
		return
	}
	if err := validateFerrataLatLngRequired(body.Lat, body.Lng); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	galerijaCreate := []string{}
	if body.Galerija != nil {
		galerijaCreate = *body.Galerija
	}
	db := c.MustGet("db").(*gorm.DB)
	slugStr, err := slug.UniqueFerrataSlug(db, naziv, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju slug-a"})
		return
	}
	f := models.Ferrata{
		Naziv:               naziv,
		Slug:                slugStr,
		Drzava:              strings.TrimSpace(body.Drzava),
		GradOpstina:         strings.TrimSpace(body.GradOpstina),
		Lokacija:            "",
		KratakOpis:          "",
		Opis:                strings.TrimSpace(body.Opis),
		Tezina:              strings.TrimSpace(body.Tezina),
		TezinaOpcija:        strings.TrimSpace(body.TezinaOpcija),
		DuzinaM:             body.DuzinaM,
		VisinskaRazlikaM:    body.VisinskaRazlikaM,
		PrilazMin:           0,
		TrajanjeMin:         body.TrajanjeMin,
		TrajanjeMax:         body.TrajanjeMax,
		PogodnoZaPocetnike:  "",
		ParkingInfo:         "",
		PovratakInfo:        "",
		NajboljeVremeInfo:   "",
		QuickTip:            strings.TrimSpace(body.QuickTip),
		WhoBeginnersText:    "",
		WhoRecreationalText: "",
		WhoExperiencedText:  "",
		HighlightsJSON:      marshalJSONArray(body.Highlights),
		OkolinaJSON:         marshalJSONArray(body.Okolina),
		GalerijaJSON:        marshalGalleryJSON(galerijaCreate),
		SmestajJSON:         ferrataSmestajJSONEmpty,
		ObaveznaOpremaJSON:  marshalObaveznaOpremaJSON(body.ObaveznaOprema),
		CoverImage:          strings.TrimSpace(body.CoverImage),
		Status:              st,
		Lat:                 body.Lat,
		Lng:                 body.Lng,
		ParkingLat:          nil,
		ParkingLng:          nil,
		MapNote:             strings.TrimSpace(body.MapNote),
	}
	if err := db.Create(&f).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Greška pri čuvanju (slug jedinstven?)"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ferrata": ferrataToMap(&f, -1)})
}

func SuperadminUpdateFerrata(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	var body superadminFerrataBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var f models.Ferrata
	if err := db.First(&f, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	if err := validateFerrataLatLngRequired(body.Lat, body.Lng); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	naziv := strings.TrimSpace(body.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv je obavezan"})
		return
	}
	prevNaziv := f.Naziv
	f.Naziv = naziv
	if strings.TrimSpace(prevNaziv) != naziv {
		slugStr, err := slug.UniqueFerrataSlug(db, naziv, uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju slug-a"})
			return
		}
		f.Slug = slugStr
	}
	f.Drzava = strings.TrimSpace(body.Drzava)
	f.GradOpstina = strings.TrimSpace(body.GradOpstina)
	f.Lokacija = ""
	f.KratakOpis = ""
	f.Opis = strings.TrimSpace(body.Opis)
	f.Tezina = strings.TrimSpace(body.Tezina)
	f.TezinaOpcija = strings.TrimSpace(body.TezinaOpcija)
	f.DuzinaM = body.DuzinaM
	f.VisinskaRazlikaM = body.VisinskaRazlikaM
	f.PrilazMin = 0
	f.TrajanjeMin = body.TrajanjeMin
	f.TrajanjeMax = body.TrajanjeMax
	f.PogodnoZaPocetnike = ""
	f.ParkingInfo = ""
	f.PovratakInfo = ""
	f.NajboljeVremeInfo = ""
	f.QuickTip = strings.TrimSpace(body.QuickTip)
	f.WhoBeginnersText = ""
	f.WhoRecreationalText = ""
	f.WhoExperiencedText = ""
	f.Lat = body.Lat
	f.Lng = body.Lng
	f.ParkingLat = nil
	f.ParkingLng = nil
	f.MapNote = strings.TrimSpace(body.MapNote)
	f.HighlightsJSON = marshalJSONArray(body.Highlights)
	f.OkolinaJSON = marshalJSONArray(body.Okolina)
	if body.Galerija != nil {
		f.GalerijaJSON = marshalGalleryJSON(*body.Galerija)
	}
	f.SmestajJSON = ferrataSmestajJSONEmpty
	f.ObaveznaOpremaJSON = marshalObaveznaOpremaJSON(body.ObaveznaOprema)
	f.CoverImage = strings.TrimSpace(body.CoverImage)
	if st := strings.TrimSpace(strings.ToLower(body.Status)); st != "" {
		if st != "active" && st != "closed" && st != "archived" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status mora biti active, closed ili archived"})
			return
		}
		f.Status = st
	}
	if err := db.Save(&f).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Greška pri ažuriranju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ferrata": ferrataToMap(&f, -1)})
}

// SuperadminDeleteFerrata DELETE — briše zapis u katalogu; via ferrata akcije ostaju, ali se odvezuju (ferrata_id = NULL, snapshot ostaje).
func SuperadminDeleteFerrata(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	uid := uint(id)
	db := c.MustGet("db").(*gorm.DB)
	var f models.Ferrata
	if err := db.First(&f, uid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Akcija{}).Where("ferrata_id = ?", uid).Updates(map[string]interface{}{"ferrata_id": nil}).Error; err != nil {
			return err
		}
		if err := tx.Where("ferrata_id = ?", uid).Delete(&models.FerrataContact{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.Ferrata{}, uid).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju ferate"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func SuperadminPatchFerrataGalerija(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	var body struct {
		Galerija []string `json:"galerija"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var f models.Ferrata
	if err := db.First(&f, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	f.GalerijaJSON = marshalGalleryJSON(body.Galerija)
	if err := db.Save(&f).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ferrata": ferrataToMap(&f, -1)})
}

// uploadCatalogSlikaMultipart polje "slika" → Cloudinary (katalog ferata ili hoteli).
func uploadCatalogSlikaMultipart(c *gin.Context, publicID, cloudinaryFolder string) (secureURL string, ok bool) {
	db := c.MustGet("db").(*gorm.DB)
	if err := c.Request.ParseMultipartForm(12 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format"})
		return "", false
	}
	files := c.Request.MultipartForm.File["slika"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite sliku (polje slika)"})
		return "", false
	}
	file := files[0]
	if err := helpers.ValidateImageFileHeader(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return "", false
	}
	if err := helpers.CheckStorageLimit(db, 0, file.Size); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return "", false
	}
	fp, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju fajla"})
		return "", false
	}
	defer fp.Close()

	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloudinary"})
		return "", false
	}
	ctx := context.Background()
	uploadParams := uploader.UploadParams{
		PublicID:       publicID,
		Folder:         cloudinaryFolder,
		Transformation: "q_auto:good,f_auto",
	}
	uploadResult, err := cld.Upload.Upload(ctx, fp, uploadParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload greška: " + err.Error()})
		return "", false
	}
	helpers.AddStorageUsage(db, 0, file.Size)
	return uploadResult.SecureURL, true
}

func uploadFerrataSlikaMultipart(c *gin.Context, publicID string) (secureURL string, ok bool) {
	return uploadCatalogSlikaMultipart(c, publicID, helpers.CloudinaryFolderFerratas())
}

func SuperadminUploadFerrataCoverDraft(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	url, ok := uploadFerrataSlikaMultipart(c, fmt.Sprintf("ferratas/new-%d", time.Now().UnixNano()))
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"coverImage": url})
}

// SuperadminUploadFerrataCover POST multipart polje "slika"
func SuperadminUploadFerrataCover(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var f models.Ferrata
	if err := db.First(&f, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	url, ok := uploadFerrataSlikaMultipart(c, fmt.Sprintf("ferratas/%d-%d", id, time.Now().Unix()))
	if !ok {
		return
	}
	if f.CoverImage != "" {
		helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), f.CoverImage)
	}
	f.CoverImage = url
	if err := db.Save(&f).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"coverImage": f.CoverImage, "ferrata": ferrataToMap(&f, -1)})
}

// SuperadminUploadFerrataGallery POST multipart polje "slika" — upload u Cloudinary (npr. slike smeštaja); vraća samo URL za ubacivanje u JSON pri čuvanju ferate.
func SuperadminUploadFerrataGallery(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var cnt int64
	db.Model(&models.Ferrata{}).Where("id = ?", id).Count(&cnt)
	if cnt == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	url, ok := uploadFerrataSlikaMultipart(c, fmt.Sprintf("ferratas/%d/gallery-%d", id, time.Now().UnixNano()))
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func SuperadminUploadFerrataGalleryDraft(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	url, ok := uploadFerrataSlikaMultipart(c, fmt.Sprintf("ferratas/new-gallery-%d", time.Now().UnixNano()))
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

type ferrataContactBody struct {
	Ime      string `json:"ime"`
	Telefon  string `json:"telefon"`
	Whatsapp string `json:"whatsapp"`
	Email    string `json:"email"`
	Napomena string `json:"napomena"`
	Aktivan  *bool  `json:"aktivan"`
}

func SuperadminCreateFerrataContact(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	fid, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID ferate"})
		return
	}
	var body ferrataContactBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	if strings.TrimSpace(body.Ime) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ime je obavezno"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var cnt int64
	db.Model(&models.Ferrata{}).Where("id = ?", fid).Count(&cnt)
	if cnt == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena"})
		return
	}
	rec := models.FerrataContact{
		FerrataID: uint(fid),
		Ime:       strings.TrimSpace(body.Ime),
		Telefon:   strings.TrimSpace(body.Telefon),
		Whatsapp:  strings.TrimSpace(body.Whatsapp),
		Email:     strings.TrimSpace(body.Email),
		Napomena:  strings.TrimSpace(body.Napomena),
		Aktivan:   true,
	}
	if body.Aktivan != nil {
		rec.Aktivan = *body.Aktivan
	}
	if err := db.Create(&rec).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"contact": rec})
}

func SuperadminUpdateFerrataContact(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID"})
		return
	}
	var body ferrataContactBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var rec models.FerrataContact
	if err := db.First(&rec, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kontakt nije pronađen"})
		return
	}
	if strings.TrimSpace(body.Ime) != "" {
		rec.Ime = strings.TrimSpace(body.Ime)
	}
	rec.Telefon = strings.TrimSpace(body.Telefon)
	rec.Whatsapp = strings.TrimSpace(body.Whatsapp)
	rec.Email = strings.TrimSpace(body.Email)
	rec.Napomena = strings.TrimSpace(body.Napomena)
	if body.Aktivan != nil {
		rec.Aktivan = *body.Aktivan
	}
	if err := db.Save(&rec).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"contact": rec})
}
