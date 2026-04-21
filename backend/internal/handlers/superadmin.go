package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)


func requireSuperadmin(c *gin.Context) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo superadmin može pristupiti"})
		return false
	}
	return true
}

func GetKlubovi(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)
	var klubovi []models.Klubovi
	if err := db.Order("naziv").Find(&klubovi).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju klubova"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"klubovi": klubovi})
}

// clubAppStat jedan red za GET /superadmin/app-stats
type clubAppStat struct {
	KlubID       uint   `json:"klubId"`
	Naziv        string `json:"naziv"`
	MemberCount  int64  `json:"memberCount"`
	ActionCount  int64  `json:"actionCount"`
}

// GetSuperadminAppStats broj članova i akcija po klubu + ukupno u aplikaciji (samo superadmin).
func GetSuperadminAppStats(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	var klubovi []models.Klubovi
	if err := db.Order("naziv").Find(&klubovi).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju klubova"})
		return
	}

	var totalUsers, totalClubMembers, totalActions int64
	if err := db.Model(&models.Korisnik{}).Count(&totalUsers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brojanju korisnika"})
		return
	}
	if err := db.Model(&models.Korisnik{}).Where("klub_id IS NOT NULL").Count(&totalClubMembers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brojanju članova"})
		return
	}
	if err := db.Model(&models.Akcija{}).Count(&totalActions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brojanju akcija"})
		return
	}

	clubs := make([]clubAppStat, 0, len(klubovi))
	for _, k := range klubovi {
		var mc, ac int64
		if err := db.Model(&models.Korisnik{}).Where("klub_id = ?", k.ID).Count(&mc).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brojanju članova kluba"})
			return
		}
		if err := db.Model(&models.Akcija{}).Where("klub_id = ?", k.ID).Count(&ac).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brojanju akcija kluba"})
			return
		}
		clubs = append(clubs, clubAppStat{
			KlubID:       k.ID,
			Naziv:        k.Naziv,
			MemberCount:  mc,
			ActionCount:  ac,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"clubs":            clubs,
		"totalUsers":       totalUsers,
		"totalClubMembers": totalClubMembers,
		// Backward-compat: postojeći klijenti očekuju totalMembers.
		"totalMembers": totalClubMembers,
		"totalActions": totalActions,
	})
}

// createKlubRequest body za POST /superadmin/klubovi
type createKlubRequest struct {
	Naziv                string   `json:"naziv"`
	Adresa               string   `json:"adresa"`
	Telefon              string   `json:"telefon"`
	Email                string   `json:"email"`
	MaticniBroj          string   `json:"maticni_broj"`
	PIB                  string   `json:"pib"`
	ZiroRacun            string   `json:"ziro_racun"`
	Sediste              string   `json:"sediste"`
	WebSajt              string   `json:"web_sajt"`
	DatumOsnivanja       string   `json:"datum_osnivanja"` // YYYY-MM-DD
	KorisnikAdminLimit   int      `json:"korisnik_admin_limit"`
	KorisnikLimit        int      `json:"korisnik_limit"`
	MaxStorageGB         float64  `json:"max_storage_gb"`
	SubscribedAt         string   `json:"subscribedAt"`         // YYYY-MM-DD
	SubscriptionEndsAt   string   `json:"subscriptionEndsAt"`  // YYYY-MM-DD
	LogoURL              string   `json:"logoUrl"`
}

func parseDate(s string) *time.Time {
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

// CreateKlub kreira novi klub (samo superadmin). Body: JSON.
func CreateKlub(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	var req createKlubRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva: " + err.Error()})
		return
	}
	naziv := strings.TrimSpace(req.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv kluba je obavezan"})
		return
	}
	if req.KorisnikAdminLimit < 0 || req.KorisnikLimit < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Limit broja admina i članova ne sme biti negativan"})
		return
	}
	if req.MaxStorageGB < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max storage (GB) ne sme biti negativan"})
		return
	}

	// Defaults ako nisu poslati
	if req.KorisnikAdminLimit == 0 {
		req.KorisnikAdminLimit = 3
	}
	if req.KorisnikLimit == 0 {
		req.KorisnikLimit = 100
	}
	if req.MaxStorageGB == 0 {
		req.MaxStorageGB = 10.0
	}

	klub := models.Klubovi{
		Naziv:               naziv,
		Adresa:              strings.TrimSpace(req.Adresa),
		Telefon:             strings.TrimSpace(req.Telefon),
		Email:               strings.TrimSpace(req.Email),
		MaticniBroj:         strings.TrimSpace(req.MaticniBroj),
		PIB:                 strings.TrimSpace(req.PIB),
		ZiroRacun:           strings.TrimSpace(req.ZiroRacun),
		Sediste:             strings.TrimSpace(req.Sediste),
		WebSajt:             strings.TrimSpace(req.WebSajt),
		KorisnikAdminLimit:  req.KorisnikAdminLimit,
		KorisnikLimit:       req.KorisnikLimit,
		MaxStorageGB:        req.MaxStorageGB,
		SubscribedAt:        parseDate(req.SubscribedAt),
		SubscriptionEndsAt:  parseDate(req.SubscriptionEndsAt),
		LogoURL:             strings.TrimSpace(req.LogoURL),
	}
	if s := strings.TrimSpace(req.DatumOsnivanja); s != "" {
		if t := parseDate(s); t != nil {
			klub.DatumOsnivanja = *t
		}
	}

	if err := db.Create(&klub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"klub": klub})
}

// updateKlubRequest body za PATCH (sva polja opciona osim što šalješ za izmenu)
type updateKlubRequest struct {
	Naziv               *string  `json:"naziv"`
	Adresa              *string  `json:"adresa"`
	Telefon             *string  `json:"telefon"`
	Email               *string  `json:"email"`
	MaticniBroj         *string  `json:"maticni_broj"`
	PIB                 *string  `json:"pib"`
	ZiroRacun           *string  `json:"ziro_racun"`
	Sediste             *string  `json:"sediste"`
	WebSajt             *string  `json:"web_sajt"`
	DatumOsnivanja      *string  `json:"datum_osnivanja"`
	KorisnikAdminLimit  *int     `json:"korisnik_admin_limit"`
	KorisnikLimit       *int     `json:"korisnik_limit"`
	MaxStorageGB        *float64 `json:"max_storage_gb"`
	SubscribedAt        *string  `json:"subscribedAt"`
	SubscriptionEndsAt  *string  `json:"subscriptionEndsAt"`
	LogoURL             *string  `json:"logoUrl"`
	OnHold              *bool    `json:"onHold"`
}

// UpdateKlub ažurira klub po ID-u (samo superadmin). PATCH, body: JSON (samo polja koja menjaš).
func UpdateKlub(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID kluba"})
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	var klub models.Klubovi
	if err := db.First(&klub, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}

	var req updateKlubRequest
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
		if t := parseDate(*req.DatumOsnivanja); t != nil {
			klub.DatumOsnivanja = *t
		}
	}
	if req.KorisnikAdminLimit != nil {
		if *req.KorisnikAdminLimit < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Limit admina ne sme biti negativan"})
			return
		}
		klub.KorisnikAdminLimit = *req.KorisnikAdminLimit
	}
	if req.KorisnikLimit != nil {
		if *req.KorisnikLimit < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Limit članova ne sme biti negativan"})
			return
		}
		klub.KorisnikLimit = *req.KorisnikLimit
	}
	if req.MaxStorageGB != nil {
		if *req.MaxStorageGB < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Max storage ne sme biti negativan"})
			return
		}
		klub.MaxStorageGB = *req.MaxStorageGB
	}
	if req.SubscribedAt != nil {
		klub.SubscribedAt = parseDate(*req.SubscribedAt)
	}
	if req.OnHold != nil {
		klub.OnHold = *req.OnHold
	}
	if req.SubscriptionEndsAt != nil {
		klub.SubscriptionEndsAt = parseDate(*req.SubscriptionEndsAt)
		// Produženje pretplate u budućnost: skinuti hold i resetovati upozorenje (mora posle req.OnHold da ne bi stari onHold iz forme prepisao)
		if klub.SubscriptionEndsAt != nil && klub.SubscriptionEndsAt.After(time.Now()) {
			klub.OnHold = false
			klub.SubscriptionWarningSentAt = nil
		}
	}
	if req.LogoURL != nil {
		klub.LogoURL = strings.TrimSpace(*req.LogoURL)
	}
	// Ako je pretplata istekla duže od grace period-a (isto kao EnsureClubHoldState), hold ostaje dok se datum ne produži u budućnost — ne može samo čekiranjem „aktivan”.
	if klub.SubscriptionEndsAt != nil {
		end := *klub.SubscriptionEndsAt
		holdDeadline := end.AddDate(0, 0, helpers.HoldDaysAfterSubscriptionEnd)
		if time.Now().After(holdDeadline) && !end.After(time.Now()) {
			klub.OnHold = true
		}
	}

	if err := db.Save(&klub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba: " + err.Error()})
		return
	}

	// Ako je ažuriran datum isteka subskripcije i ističe uskoro (≤5 dana), obavesti admin i sekretar kluba
	if req.SubscriptionEndsAt != nil && klub.SubscriptionEndsAt != nil {
		end := *klub.SubscriptionEndsAt
		now := time.Now()
		daysLeft := int(end.Sub(now).Hours() / 24)
		if daysLeft >= 0 && daysLeft <= 5 {
			var adminIDs []uint
			if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role IN ?", uint(id), []string{"admin", "sekretar"}).Pluck("id", &adminIDs).Error; err == nil && len(adminIDs) > 0 {
				endStr := end.Format("02.01.2006")
				title := "Subskripcija kluba ističe uskoro"
				body := "Subskripcija vašeg kluba \"" + klub.Naziv + "\" ističe " + endStr + ". Kontaktirajte superadmina za produženje."
				notifications.NotifyUsers(db, adminIDs, models.ObavestenjeTipSubskripcija, title, body, "/home", "")
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"klub": klub})
}

// DeleteKlub briše klub po ID-u (samo superadmin). Ne dozvoljava brisanje ako klub ima članove.
func DeleteKlub(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID kluba"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	clubID := uint(id)
	var memberCount int64
	if err := db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Count(&memberCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri članova"})
		return
	}
	if memberCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Ne možete obrisati klub koji ima članove. Prvo premestite ili obrišite članove."})
		return
	}
	var akcijeCount int64
	if err := db.Model(&models.Akcija{}).Where("klub_id = ?", clubID).Count(&akcijeCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri akcija"})
		return
	}
	if akcijeCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Ne možete obrisati klub koji ima akcije. Prvo obrišite ili premestite akcije."})
		return
	}

	if err := db.Delete(&models.Klubovi{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju kluba: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Klub uspešno obrisan"})
}

// UpdateKlubLogo menja logo kluba (samo superadmin).
func UpdateKlubLogo(c *gin.Context) {
	roleVal, _ := c.Get("role")
	if roleVal != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo superadmin može menjati logo kluba"})
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID kluba"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var klub models.Klubovi
	if err := db.First(&klub, id).Error; err != nil {
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
	if err := helpers.CheckStorageLimit(db, uint(id), file.Size); err != nil {
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
		PublicID:       fmt.Sprintf("klubovi/klub-logo-%d-%d", id, time.Now().Unix()),
		Folder:         helpers.CloudinaryFolderForClub(uint(id)),
		Transformation: "q_auto:good,f_auto",
	}
	uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u loga: " + err.Error()})
		return
	}
	helpers.AddStorageUsage(db, uint(id), file.Size)
	helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), klub.LogoURL)
	klub.LogoURL = uploadResult.SecureURL
	if err := db.Save(&klub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"klub": klub})
}

// GetSuperadminNoClubUsers GET /api/superadmin/korisnici/bez-kluba?q= — korisnici sa klub_id IS NULL (osim obrisanih).
func GetSuperadminNoClubUsers(c *gin.Context) {
	if !requireSuperadmin(c) {
		return
	}
	dbAny, ok := c.Get("db")
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	q := strings.TrimSpace(c.Query("q"))
	q = strings.ReplaceAll(strings.ReplaceAll(q, "%", ""), "_", "")

	type rowDTO struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
		FullName string `json:"fullName,omitempty"`
		Email    string `json:"email,omitempty"`
	}

	query := db.Model(&models.Korisnik{}).Where("klub_id IS NULL AND role <> ?", "deleted")
	if q != "" {
		pat := "%" + strings.ToLower(q) + "%"
		query = query.Where("(LOWER(username) LIKE ? OR LOWER(full_name) LIKE ?)", pat, pat)
	}

	var rows []models.Korisnik
	if err := query.Order("username ASC").Limit(500).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju korisnika"})
		return
	}

	out := make([]rowDTO, 0, len(rows))
	for i := range rows {
		out = append(out, rowDTO{
			ID:       rows[i].ID,
			Username: rows[i].Username,
			FullName: rows[i].FullName,
			Email:    rows[i].Email,
		})
	}
	c.JSON(http.StatusOK, gin.H{"korisnici": out})
}
