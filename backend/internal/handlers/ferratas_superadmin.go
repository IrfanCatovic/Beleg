package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/slug"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SuperadminListFerratas(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	db := DB(c)
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
	db := DB(c)
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
	Lat      *float64  `json:"lat"`
	Lng      *float64  `json:"lng"`
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
	db := DB(c)
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
	db := DB(c)
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
	db := DB(c)
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
	db := DB(c)
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
	db := DB(c)
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

	secureURL, uploadErr := helpers.UploadImage(cloudinaryFolder, publicID, fp)
	if uploadErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload greška: " + uploadErr.Error()})
		return "", false
	}
	helpers.AddStorageUsage(db, 0, file.Size)
	return secureURL, true
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
	db := DB(c)
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
	db := DB(c)
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
	db := DB(c)
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
	db := DB(c)
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
