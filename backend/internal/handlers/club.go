// Paket handlers za "Moj klub": stranica koju vidi svaki član kluba.
// GET /api/klub vraća podatke effective kluba (helpers.GetEffectiveClubID).
// PATCH /api/klub ažurira te podatke – samo admin ili sekretar tog kluba (ili superadmin u ulozi kluba).
// Superadmin menja limite, subskripciju i logo preko /api/superadmin/klubovi/:id; ovde klub menja osnovne podatke (naziv, adresa, kontakt, itd.).
package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var allowedClubCurrencies = map[string]struct{}{
	"RSD": {},
	"BAM": {},
	"HRK": {},
	"EUR": {},
}

// GetMojKlub vraća podatke kluba za trenutni kontekst (effective club).
// Svi ulogovani članovi kluba mogu da vide; superadmin mora da pošalje X-Club-Id.
func GetMojKlub(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Niste u klubu"})
		return
	}

	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"klub": klub})
}

// GetClubAdminStats vraća osetljive brojke za effective klub (članovi, admini, skladište, subskripcija).
// Samo admin ili sekretar tog kluba ili superadmin u kontekstu tog kluba (X-Club-Id).
func GetClubAdminStats(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Niste u klubu"})
		return
	}

	if !canEditClub(c, db, clubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar kluba vide administraciju"})
		return
	}

	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}

	var activeMembers int64
	if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role != ?", clubID, "deleted").Count(&activeMembers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brojanju članova"})
		return
	}

	var adminCount int64
	if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role = ?", clubID, "admin").Count(&adminCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brojanju admina"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"activeMembers":      activeMembers,
		"maxMembers":         klub.KorisnikLimit,
		"adminCount":         adminCount,
		"maxAdmins":          klub.KorisnikAdminLimit,
		"usedStorageGb":      klub.UsedStorageGB,
		"maxStorageGb":       klub.MaxStorageGB,
		"subscriptionEndsAt": klub.SubscriptionEndsAt,
		"subscribedAt":       klub.SubscribedAt,
		"onHold":             klub.OnHold,
	})
}

// updateMojKlubRequest polja koja klub (admin/sekretar) može da menja.
// Limite, subskripciju i OnHold menja samo superadmin preko superadmin ruta.
type updateMojKlubRequest struct {
	Naziv          *string `json:"naziv"`
	Valuta         *string `json:"valuta"`
	Adresa         *string `json:"adresa"`
	Telefon        *string `json:"telefon"`
	Email          *string `json:"email"`
	MaticniBroj    *string `json:"maticni_broj"`
	PIB            *string `json:"pib"`
	ZiroRacun      *string `json:"ziro_racun"`
	Sediste        *string `json:"sediste"`
	WebSajt        *string `json:"web_sajt"`
	DatumOsnivanja *string `json:"datum_osnivanja"` // YYYY-MM-DD
}

func parseOptionalDate(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

// canEditClub vraća da li trenutni korisnik sme da menja podatke kluba (admin, sekretar tog kluba ili superadmin).
func canEditClub(c *gin.Context, db *gorm.DB, clubID uint) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role == "superadmin" {
		return true
	}
	if role != "admin" && role != "sekretar" {
		return false
	}
	usernameVal, _ := c.Get("username")
	username, _ := usernameVal.(string)
	var k models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&k).Error; err != nil {
		return false
	}
	return k.KlubID != nil && *k.KlubID == clubID
}

// UpdateMojKlub ažurira osnovne podatke effective kluba (naziv, adresa, kontakt, itd.).
// Samo admin ili sekretar tog kluba, ili superadmin kada je izabrao taj klub.
func UpdateMojKlub(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Niste u klubu"})
		return
	}

	if !canEditClub(c, db, clubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar kluba mogu da menjaju podatke kluba"})
		return
	}

	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}

	var req updateMojKlubRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva: " + err.Error()})
		return
	}

	if req.Naziv != nil {
		n := strings.TrimSpace(*req.Naziv)
		if n == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv kluba ne sme biti prazan"})
			return
		}
		klub.Naziv = n
	}
	if req.Valuta != nil {
		val := strings.ToUpper(strings.TrimSpace(*req.Valuta))
		if _, ok := allowedClubCurrencies[val]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća valuta (dozvoljeno: RSD, BAM, HRK, EUR)"})
			return
		}
		klub.Valuta = val
	}
	if req.Adresa != nil {
		klub.Adresa = strings.TrimSpace(*req.Adresa)
	}
	if req.Telefon != nil {
		klub.Telefon = strings.TrimSpace(*req.Telefon)
	}
	if req.Email != nil {
		klub.Email = strings.TrimSpace(*req.Email)
	}
	if req.MaticniBroj != nil {
		klub.MaticniBroj = strings.TrimSpace(*req.MaticniBroj)
	}
	if req.PIB != nil {
		klub.PIB = strings.TrimSpace(*req.PIB)
	}
	if req.ZiroRacun != nil {
		klub.ZiroRacun = strings.TrimSpace(*req.ZiroRacun)
	}
	if req.Sediste != nil {
		klub.Sediste = strings.TrimSpace(*req.Sediste)
	}
	if req.WebSajt != nil {
		klub.WebSajt = strings.TrimSpace(*req.WebSajt)
	}
	if req.DatumOsnivanja != nil {
		if t := parseOptionalDate(*req.DatumOsnivanja); t != nil {
			klub.DatumOsnivanja = *t
		}
	}

	if err := db.Save(&klub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"klub": klub})
}

// UpdateMojKlubLogo menja logo effective kluba (admin/sekretar kluba ili superadmin).
func UpdateMojKlubLogo(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok || clubID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (X-Club-Id) ili niste u klubu"})
		return
	}
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "superadmin" && role != "admin" && role != "sekretar" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar kluba mogu da menjaju logo"})
		return
	}
	if role != "superadmin" {
		usernameVal, _ := c.Get("username")
		username, _ := usernameVal.(string)
		var k models.Korisnik
		if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&k).Error; err != nil || k.KlubID == nil || *k.KlubID != clubID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Možete menjati samo logo svog kluba"})
			return
		}
	}
	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}
	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}
	files := c.Request.MultipartForm.File["logo"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite sliku (polje logo)"})
		return
	}
	file := files[0]
	if err := helpers.ValidateImageFileHeader(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna slika loga: " + err.Error()})
		return
	}
	if err := helpers.CheckStorageLimit(db, clubID, file.Size); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju fajla"})
		return
	}
	defer f.Close()
	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri inicijalizaciji Cloudinary-ja"})
		return
	}
	ctx := context.Background()
	uploadParams := uploader.UploadParams{
		PublicID:       fmt.Sprintf("klubovi/klub-logo-%d-%d", clubID, time.Now().Unix()),
		Folder:         helpers.CloudinaryFolderForClub(clubID),
		Transformation: "q_auto:good,f_auto",
	}
	uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u loga: " + err.Error()})
		return
	}
	helpers.AddStorageUsage(db, clubID, file.Size)
	helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), klub.LogoURL)
	klub.LogoURL = uploadResult.SecureURL
	if err := db.Save(&klub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"klub": klub})
}
