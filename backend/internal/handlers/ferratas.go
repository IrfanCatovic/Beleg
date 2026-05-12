package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

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

func buildFerrataSnapshotBytes(f *models.Ferrata) ([]byte, error) {
	p := ferrataSnapshotPayload{
		Naziv:              f.Naziv,
		Lokacija:           f.Lokacija,
		Tezina:             f.Tezina,
		TezinaOpcija:       f.TezinaOpcija,
		DuzinaM:            f.DuzinaM,
		VisinskaRazlikaM:   f.VisinskaRazlikaM,
		PrilazMin:          f.PrilazMin,
		TrajanjeMin:        f.TrajanjeMin,
		TrajanjeMax:        f.TrajanjeMax,
		PogodnoZaPocetnike: f.PogodnoZaPocetnike,
		ObaveznaOprema:     parseStringSliceJSON(f.ObaveznaOpremaJSON),
	}
	return json.Marshal(p)
}

func ferrataToMap(f *models.Ferrata, upcoming int64) gin.H {
	m := gin.H{
		"id":                 f.ID,
		"naziv":              f.Naziv,
		"slug":               f.Slug,
		"drzava":             f.Drzava,
		"gradOpstina":        f.GradOpstina,
		"lokacija":           f.Lokacija,
		"kratakOpis":         f.KratakOpis,
		"opis":               f.Opis,
		"tezina":             f.Tezina,
		"tezinaOpcija":       f.TezinaOpcija,
		"duzinaM":            f.DuzinaM,
		"visinskaRazlikaM":   f.VisinskaRazlikaM,
		"prilazMin":          f.PrilazMin,
		"trajanjeMin":        f.TrajanjeMin,
		"trajanjeMax":        f.TrajanjeMax,
		"pogodnoZaPocetnike": f.PogodnoZaPocetnike,
		"highlights":         parseStringSliceJSON(f.HighlightsJSON),
		"obaveznaOprema":     parseStringSliceJSON(f.ObaveznaOpremaJSON),
		"coverImage":         f.CoverImage,
		"status":             f.Status,
		"createdAt":          f.CreatedAt,
		"updatedAt":          f.UpdatedAt,
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
		q = q.Where("(LOWER(naziv) LIKE ? OR LOWER(lokacija) LIKE ? OR LOWER(drzava) LIKE ? OR LOWER(grad_opstina) LIKE ?)", pat, pat, pat, pat)
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

type superadminFerrataBody struct {
	Naziv              string   `json:"naziv"`
	Slug               string   `json:"slug"`
	Drzava             string   `json:"drzava"`
	GradOpstina        string   `json:"gradOpstina"`
	Lokacija           string   `json:"lokacija"`
	KratakOpis         string   `json:"kratakOpis"`
	Opis               string   `json:"opis"`
	Tezina             string   `json:"tezina"`
	TezinaOpcija       string   `json:"tezinaOpcija"`
	DuzinaM            int      `json:"duzinaM"`
	VisinskaRazlikaM   int      `json:"visinskaRazlikaM"`
	PrilazMin          int      `json:"prilazMin"`
	TrajanjeMin        int      `json:"trajanjeMin"`
	TrajanjeMax        int      `json:"trajanjeMax"`
	PogodnoZaPocetnike string   `json:"pogodnoZaPocetnike"`
	Highlights         []string `json:"highlights"`
	ObaveznaOprema     []string `json:"obaveznaOprema"`
	CoverImage         string   `json:"coverImage"`
	Status             string   `json:"status"`
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
	if strings.TrimSpace(body.Naziv) == "" || strings.TrimSpace(body.Slug) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv i slug su obavezni"})
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
	f := models.Ferrata{
		Naziv:              strings.TrimSpace(body.Naziv),
		Slug:               strings.TrimSpace(body.Slug),
		Drzava:             strings.TrimSpace(body.Drzava),
		GradOpstina:        strings.TrimSpace(body.GradOpstina),
		Lokacija:           strings.TrimSpace(body.Lokacija),
		KratakOpis:         strings.TrimSpace(body.KratakOpis),
		Opis:               strings.TrimSpace(body.Opis),
		Tezina:             strings.TrimSpace(body.Tezina),
		TezinaOpcija:       strings.TrimSpace(body.TezinaOpcija),
		DuzinaM:            body.DuzinaM,
		VisinskaRazlikaM:   body.VisinskaRazlikaM,
		PrilazMin:          body.PrilazMin,
		TrajanjeMin:        body.TrajanjeMin,
		TrajanjeMax:        body.TrajanjeMax,
		PogodnoZaPocetnike: strings.TrimSpace(body.PogodnoZaPocetnike),
		HighlightsJSON:     marshalJSONArray(body.Highlights),
		ObaveznaOpremaJSON: marshalJSONArray(body.ObaveznaOprema),
		CoverImage:         strings.TrimSpace(body.CoverImage),
		Status:             st,
	}
	db := c.MustGet("db").(*gorm.DB)
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
	if strings.TrimSpace(body.Naziv) != "" {
		f.Naziv = strings.TrimSpace(body.Naziv)
	}
	if strings.TrimSpace(body.Slug) != "" {
		f.Slug = strings.TrimSpace(body.Slug)
	}
	f.Drzava = strings.TrimSpace(body.Drzava)
	f.GradOpstina = strings.TrimSpace(body.GradOpstina)
	f.Lokacija = strings.TrimSpace(body.Lokacija)
	f.KratakOpis = strings.TrimSpace(body.KratakOpis)
	f.Opis = strings.TrimSpace(body.Opis)
	f.Tezina = strings.TrimSpace(body.Tezina)
	f.TezinaOpcija = strings.TrimSpace(body.TezinaOpcija)
	f.DuzinaM = body.DuzinaM
	f.VisinskaRazlikaM = body.VisinskaRazlikaM
	f.PrilazMin = body.PrilazMin
	f.TrajanjeMin = body.TrajanjeMin
	f.TrajanjeMax = body.TrajanjeMax
	f.PogodnoZaPocetnike = strings.TrimSpace(body.PogodnoZaPocetnike)
	if body.Highlights != nil {
		f.HighlightsJSON = marshalJSONArray(body.Highlights)
	}
	if body.ObaveznaOprema != nil {
		f.ObaveznaOpremaJSON = marshalJSONArray(body.ObaveznaOprema)
	}
	if body.CoverImage != "" {
		f.CoverImage = strings.TrimSpace(body.CoverImage)
	}
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
	if err := c.Request.ParseMultipartForm(12 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format"})
		return
	}
	files := c.Request.MultipartForm.File["slika"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite sliku (polje slika)"})
		return
	}
	file := files[0]
	if err := helpers.ValidateImageFileHeader(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := helpers.CheckStorageLimit(db, 0, file.Size); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	fp, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju fajla"})
		return
	}
	defer fp.Close()

	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloudinary"})
		return
	}
	ctx := context.Background()
	uploadParams := uploader.UploadParams{
		PublicID:       fmt.Sprintf("ferratas/%d-%d", id, time.Now().Unix()),
		Folder:         helpers.CloudinaryFolderFerratas(),
		Transformation: "q_auto:good,f_auto",
	}
	uploadResult, err := cld.Upload.Upload(ctx, fp, uploadParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload greška: " + err.Error()})
		return
	}
	helpers.AddStorageUsage(db, 0, file.Size)
	if f.CoverImage != "" {
		helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), f.CoverImage)
	}
	f.CoverImage = uploadResult.SecureURL
	if err := db.Save(&f).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"coverImage": f.CoverImage, "ferrata": ferrataToMap(&f, -1)})
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
