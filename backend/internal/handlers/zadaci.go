// Zadaci su club-scoped: svaki zadatak ima klub_id; lista i sve akcije (preuzmi, izmeni, završi, obriši)
// filtriraju se po helpers.GetEffectiveClubID. Obaveštenje za novi zadatak ide samo članovima tog kluba.
package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createZadatakRequest struct {
	Naziv        string   `json:"naziv" binding:"required"`
	Opis         string   `json:"opis"`
	Deadline     *string  `json:"deadline"`
	Hitno        bool     `json:"hitno"`
	AllowedRoles []string `json:"allowedRoles"`
	AllowAll     bool     `json:"allowAll"`
}

type updateZadatakRequest struct {
	Naziv        *string   `json:"naziv"`
	Opis         *string   `json:"opis"`
	Deadline     *string   `json:"deadline"`
	Hitno        *bool     `json:"hitno"`
	AllowedRoles *[]string `json:"allowedRoles"`
	AllowAll     *bool     `json:"allowAll"`
}

type zadatakAssignee struct {
	Username string `json:"username"`
	FullName string `json:"fullName"`
	Role     string `json:"role"`
}

type zadatakResponse struct {
	models.Zadatak
	Assignees []zadatakAssignee `json:"assignees"`
}

func checkZadatakCreateRole(c *gin.Context) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	return role == "admin" || role == "superadmin" || role == "sekretar"
}

func buildZadatakResponse(z models.Zadatak) zadatakResponse {
	assignees := make([]zadatakAssignee, 0, len(z.ZadatakKorisnici))
	for _, zk := range z.ZadatakKorisnici {
		if zk.Korisnik.ID != 0 {
			assignees = append(assignees, zadatakAssignee{
				Username: zk.Korisnik.Username,
				FullName: zk.Korisnik.FullName,
				Role:     zk.Korisnik.Role,
			})
		}
	}
	return zadatakResponse{Zadatak: z, Assignees: assignees}
}

// GetZadaci vraća samo zadatke effective kluba.
func GetZadaci(c *gin.Context) {
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
		c.JSON(http.StatusOK, []zadatakResponse{})
		return
	}

	var zadaci []models.Zadatak
	if err := db.Where("klub_id = ?", clubID).Preload("ZadatakKorisnici.Korisnik").Order("created_at DESC").Find(&zadaci).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju zadataka"})
		return
	}
	out := make([]zadatakResponse, 0, len(zadaci))
	for _, z := range zadaci {
		out = append(out, buildZadatakResponse(z))
	}
	c.JSON(http.StatusOK, out)
}

// GetZadatakByID vraća jedan zadatak effective kluba.
func GetZadatakByID(c *gin.Context) {
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}

	idStr := c.Param("id")
	zid, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zadatka"})
		return
	}

	var z models.Zadatak
	if err := db.Where("id = ? AND klub_id = ?", zid, clubID).
		Preload("ZadatakKorisnici.Korisnik").
		First(&z).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}

	c.JSON(http.StatusOK, buildZadatakResponse(z))
}

func CreateZadatak(c *gin.Context) {
	if !checkZadatakCreateRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu da kreiraju zadatke"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Zadatak mora biti vezan za klub"})
		return
	}

	var req createZadatakRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći zahtev (npr. nedostaje naziv)"})
		return
	}

	naziv := strings.TrimSpace(req.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv zadatka je obavezan"})
		return
	}
	if !req.AllowAll && len(req.AllowedRoles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite barem jednu ulogu ili opciju Svi"})
		return
	}

	var deadline *time.Time
	if req.Deadline != nil && strings.TrimSpace(*req.Deadline) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.Deadline))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Deadline mora biti u formatu YYYY-MM-DD"})
			return
		}
		deadline = &t
	}

	zadatak := models.Zadatak{
		Naziv:        naziv,
		Opis:         strings.TrimSpace(req.Opis),
		AllowedRoles: req.AllowedRoles,
		AllowAll:     req.AllowAll,
		Deadline:     deadline,
		Hitno:        req.Hitno,
		Status:       models.ZadatakStatusAktivni,
		KlubID:       &clubID,
	}
	if err := db.Create(&zadatak).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju zadatka"})
		return
	}
	// Obaveštenje samo korisnicima ovog kluba koji mogu da vide zadatak (AllowAll = svi u klubu, inače po ulogama u klubu)
	var recipientIDs []uint
	if zadatak.AllowAll {
		db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Pluck("id", &recipientIDs)
	} else {
		db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Where("role IN ?", zadatak.AllowedRoles).Pluck("id", &recipientIDs)
	}
	notifications.NotifyUsers(db, recipientIDs, models.ObavestenjeTipZadatak, "Novi zadatak", zadatak.Naziv, "/zadaci", fmt.Sprintf(`{"zadatakId":%d}`, zadatak.ID))
	c.JSON(http.StatusCreated, gin.H{"zadatak": buildZadatakResponse(zadatak)})
}

func parseZadatakID(c *gin.Context) (uint, bool) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zadatka"})
		return 0, false
	}
	return uint(id), true
}

func canTakeZadatakByRole(z models.Zadatak, userRole string) bool {
	if z.AllowAll {
		return true
	}
	role := strings.TrimSpace(strings.ToLower(userRole))
	for _, allowed := range z.AllowedRoles {
		if role == strings.TrimSpace(strings.ToLower(allowed)) {
			return true
		}
	}
	return false
}

// PreuzmiZadatak — POST /zadaci/:id/preuzmi. Korisnik se pridružuje zadatku; ako je status "aktivni", prelazi u "u_toku".
func PreuzmiZadatak(c *gin.Context) {
	zadatakID, ok := parseZadatakID(c)
	if !ok {
		return
	}
	usernameVal, _ := c.Get("username")
	username, _ := usernameVal.(string)
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var z models.Zadatak
	if err := db.First(&z, zadatakID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.KlubID == nil || *z.KlubID != clubID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.Status == models.ZadatakStatusZavrsen {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Završen zadatak ne može se preuzimati"})
		return
	}
	if !canTakeZadatakByRole(z, korisnik.Role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Vaša uloga nema dozvolu za preuzimanje ovog zadatka"})
		return
	}

	var existing models.ZadatakKorisnik
	if err := db.Where("zadatak_id = ? AND korisnik_id = ?", zadatakID, korisnik.ID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Već ste preuzeli ovaj zadatak"})
		return
	}

	if z.Status == models.ZadatakStatusAktivni {
		if err := db.Model(&z).Update("status", models.ZadatakStatusUToku).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju statusa"})
			return
		}
		z.Status = models.ZadatakStatusUToku
	}

	zk := models.ZadatakKorisnik{ZadatakID: zadatakID, KorisnikID: korisnik.ID}
	if err := db.Create(&zk).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri pridruživanju zadatku"})
		return
	}

	var updated models.Zadatak
	if err := db.Preload("ZadatakKorisnici.Korisnik").First(&updated, zadatakID).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"zadatak": buildZadatakResponse(z)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"zadatak": buildZadatakResponse(updated)})
}

// NapustiZadatak — POST /zadaci/:id/napusti. Uklanja trenutnog korisnika sa zadatka; ako niko više ne radi, status se vraća na "aktivni".
func NapustiZadatak(c *gin.Context) {
	zadatakID, ok := parseZadatakID(c)
	if !ok {
		return
	}
	usernameVal, _ := c.Get("username")
	username, _ := usernameVal.(string)
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var z models.Zadatak
	if err := db.First(&z, zadatakID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.KlubID == nil || *z.KlubID != clubID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.Status == models.ZadatakStatusZavrsen {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete se povući sa završenog zadatka"})
		return
	}

	res := db.Where("zadatak_id = ? AND korisnik_id = ?", zadatakID, korisnik.ID).Delete(&models.ZadatakKorisnik{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju zadatka"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Niste prijavljeni na ovaj zadatak"})
		return
	}

	var remaining int64
	if err := db.Model(&models.ZadatakKorisnik{}).Where("zadatak_id = ?", zadatakID).Count(&remaining).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju zadatka"})
		return
	}
	if remaining == 0 && z.Status == models.ZadatakStatusUToku {
		if err := db.Model(&z).Update("status", models.ZadatakStatusAktivni).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju statusa"})
			return
		}
		z.Status = models.ZadatakStatusAktivni
	}

	var updated models.Zadatak
	if err := db.Preload("ZadatakKorisnici.Korisnik").First(&updated, zadatakID).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"zadatak": buildZadatakResponse(z)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"zadatak": buildZadatakResponse(updated)})
}

// UpdateZadatak — PATCH /zadaci/:id. Samo admin/sekretar; zabranjeno ako je status "zavrsen".
func UpdateZadatak(c *gin.Context) {
	if !checkZadatakCreateRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu da menjaju zadatke"})
		return
	}
	zadatakID, ok := parseZadatakID(c)
	if !ok {
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}

	var z models.Zadatak
	if err := db.First(&z, zadatakID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.KlubID == nil || *z.KlubID != clubID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.Status == models.ZadatakStatusZavrsen {
		c.JSON(http.StatusForbidden, gin.H{"error": "Završen zadatak nije moguće menjati"})
		return
	}

	var req updateZadatakRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći zahtev"})
		return
	}

	updates := make(map[string]interface{})
	if req.Naziv != nil {
		s := strings.TrimSpace(*req.Naziv)
		if s == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv ne sme biti prazan"})
			return
		}
		updates["naziv"] = s
	}
	if req.Opis != nil {
		updates["opis"] = strings.TrimSpace(*req.Opis)
	}
	if req.Deadline != nil {
		if *req.Deadline == "" {
			updates["deadline"] = nil
		} else {
			t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.Deadline))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Deadline mora biti YYYY-MM-DD"})
				return
			}
			updates["deadline"] = t
		}
	}
	if req.Hitno != nil {
		updates["hitno"] = *req.Hitno
	}
	if req.AllowedRoles != nil {
		updates["allowed_roles"] = *req.AllowedRoles
	}
	if req.AllowAll != nil {
		updates["allow_all"] = *req.AllowAll
	}

	if len(updates) > 0 {
		if err := db.Model(&z).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju"})
			return
		}
	}

	var updated models.Zadatak
	_ = db.Preload("ZadatakKorisnici.Korisnik").First(&updated, zadatakID)
	c.JSON(http.StatusOK, gin.H{"zadatak": buildZadatakResponse(updated)})
}

// ZavrsiZadatak — POST /zadaci/:id/zavrsi. Samo admin/sekretar; postavlja status "zavrsen".
func ZavrsiZadatak(c *gin.Context) {
	if !checkZadatakCreateRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu da završe zadatke"})
		return
	}
	zadatakID, ok := parseZadatakID(c)
	if !ok {
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}

	var z models.Zadatak
	if err := db.First(&z, zadatakID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.KlubID == nil || *z.KlubID != clubID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.Status == models.ZadatakStatusZavrsen {
		c.JSON(http.StatusOK, gin.H{"zadatak": buildZadatakResponse(z)})
		return
	}
	if err := db.Model(&z).Update("status", models.ZadatakStatusZavrsen).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri označavanju zadatka kao završen"})
		return
	}
	z.Status = models.ZadatakStatusZavrsen
	c.JSON(http.StatusOK, gin.H{"zadatak": buildZadatakResponse(z)})
}

// DeleteZadatak — DELETE /zadaci/:id. Samo admin/sekretar (npr. za završene zadatke).
func DeleteZadatak(c *gin.Context) {
	if !checkZadatakCreateRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu da brišu zadatke"})
		return
	}
	zadatakID, ok := parseZadatakID(c)
	if !ok {
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}

	var z models.Zadatak
	if err := db.First(&z, zadatakID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}
	if z.KlubID == nil || *z.KlubID != clubID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zadatak nije pronađen"})
		return
	}

	if err := db.Where("zadatak_id = ?", zadatakID).Delete(&models.ZadatakKorisnik{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju veza"})
		return
	}
	if err := db.Delete(&models.Zadatak{}, zadatakID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju zadatka"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Zadatak obrisan"})
}
