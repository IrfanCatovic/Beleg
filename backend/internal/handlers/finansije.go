package handlers

import (
	"net/http"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)


func checkFinanceRole(c *gin.Context) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	return role == "admin" || role == "superadmin" || role == "blagajnik"
}


func GetDashboard(c *gin.Context) {
	if !checkFinanceRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili blagajnik mogu da vide finansije"})
		return
	}

	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	fromStr := c.Query("from")
	toStr := c.Query("to")
	year := time.Now().Year()
	if fromStr == "" {
		fromStr = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	}
	if toStr == "" {
		toStr = time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC).Format("2006-01-02")
	}
	from, errFrom := time.Parse("2006-01-02", fromStr)
	toParsed, errTo := time.Parse("2006-01-02", toStr)
	if errFrom != nil || errTo != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format datuma (očekuje se YYYY-MM-DD)"})
		return
	}
	// Kraj dana za "do" da uključi sve transakcije tog dana
	from = time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	to := time.Date(toParsed.Year(), toParsed.Month(), toParsed.Day(), 23, 59, 59, 999999999, time.UTC)
	if from.After(to) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datum 'od' mora biti pre datuma 'do'"})
		return
	}

	// Transakcije u periodu
	var transakcije []models.Transakcija
	if err := db.Where("datum >= ? AND datum <= ?", from, to).
		Order("datum DESC, created_at DESC").
		Preload("Korisnik").Preload("ClanarinaKorisnik").
		Find(&transakcije).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju transakcija"})
		return
	}

	var ukupnoUplate, ukupnoIsplate float64
	for _, t := range transakcije {
		if t.Tip == "uplata" {
			ukupnoUplate += t.Iznos
		} else {
			// Isplate su u bazi upisane kao negativan iznos
			ukupnoIsplate += -t.Iznos
		}
	}
	// Trenutno stanje = uplate − isplate (u bazi su isplate negativne)
	saldo := ukupnoUplate - ukupnoIsplate

	c.JSON(http.StatusOK, gin.H{
		"saldo":       saldo,
		"uplate":     ukupnoUplate,
		"isplate":    ukupnoIsplate,
		"transakcije": transakcije,
		"from":       fromStr,
		"to":         toStr,
	})
}

// GetTransakcije vraća listu svih transakcija (uplata i isplata).
// Dostupno samo admin i blagajnik.
func GetTransakcije(c *gin.Context) {
	if !checkFinanceRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili blagajnik mogu da vide finansije"})
		return
	}

	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)

	var transakcije []models.Transakcija
	if err := db.Order("datum DESC, created_at DESC").Preload("Korisnik").Find(&transakcije).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju transakcija"})
		return
	}

	c.JSON(http.StatusOK, transakcije)
}

// CreateTransakcija kreira novu uplatu ili isplatu (ručni unos).
// Body: { "tip": "uplata"|"isplata", "iznos": number, "opis": string, "datum": "YYYY-MM-DD" }
func CreateTransakcija(c *gin.Context) {
	if !checkFinanceRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili blagajnik mogu da dodaju transakcije"})
		return
	}

	var body struct {
		Tip   string  `json:"tip" binding:"required"`
		Iznos float64 `json:"iznos" binding:"required"`
		Opis  string  `json:"opis"`
		Datum string  `json:"datum" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format (obavezno: tip, iznos, datum)"})
		return
	}
	if body.Tip != "uplata" && body.Tip != "isplata" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tip mora biti 'uplata' ili 'isplata'"})
		return
	}
	if body.Iznos <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Iznos mora biti pozitivan"})
		return
	}
	datum, err := time.Parse("2006-01-02", body.Datum)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format datuma (YYYY-MM-DD)"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	usernameVal, _ := c.Get("username")
	var ulogovan models.Korisnik
	if err := db.Where("username = ?", usernameVal).First(&ulogovan).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	iznos := body.Iznos
	if body.Tip == "isplata" {
		iznos = -body.Iznos
	}
	t := models.Transakcija{
		Tip:        body.Tip,
		Iznos:      iznos,
		Opis:       body.Opis,
		Datum:      datum,
		KorisnikID: ulogovan.ID,
	}
	if err := db.Create(&t).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju transakcije"})
		return
	}
	// Obaveštenje za admin i blagajnik
	var adminBlagajnikIDs []uint
	db.Model(&models.Korisnik{}).Where("role IN ?", []string{"admin", "blagajnik"}).Pluck("id", &adminBlagajnikIDs)
	notifications.NotifyUsers(db, adminBlagajnikIDs, models.ObavestenjeTipUplata, "Nova transakcija", body.Opis, "/finansije")
	c.JSON(http.StatusCreated, t)
}

// GetClanarine vraća listu korisnika sa statusom članarine za datu godinu.
// Status "platio" = postoji uplata u toj godini; za novu godinu svi su početno neplaćeni (nema transakcija).
// Query: godina=2025 (default: tekuća godina)
func GetClanarine(c *gin.Context) {
	if !checkFinanceRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili blagajnik mogu da vide članarine"})
		return
	}

	godina := time.Now().Year()
	if g := c.Query("godina"); g != "" {
		if parsed, err := time.Parse("2006", g); err == nil {
			godina = parsed.Year()
		}
	}

	db := c.MustGet("db").(*gorm.DB)

	var korisnici []models.Korisnik
	if err := db.Order("full_name, username").Find(&korisnici).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju korisnika"})
		return
	}

	from := time.Date(godina, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(godina, 12, 31, 23, 59, 59, 0, time.UTC)

	// Za svakog korisnika proveri da li ima uplatu sa ClanarinaKorisnikID u toj godini
	type ClanarinaStatus struct {
		ID       uint   `json:"id"`
		FullName string `json:"fullName"`
		Username string `json:"username"`
		Platio   bool   `json:"platio"`
	}
	var result []ClanarinaStatus
	for _, k := range korisnici {
		var count int64
		db.Model(&models.Transakcija{}).Where("tip = ? AND clanarina_korisnik_id = ? AND datum >= ? AND datum <= ?", "uplata", k.ID, from, to).Count(&count)
		result = append(result, ClanarinaStatus{
			ID:       k.ID,
			FullName: k.FullName,
			Username: k.Username,
			Platio:   count > 0,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"godina":    godina,
		"clanarine": result,
	})
}

// PostClanarinaPlati označava da je korisnik platio članarinu.
// Body: { "korisnikId": number, "iznos": number, "datum": "YYYY-MM-DD" }
func PostClanarinaPlati(c *gin.Context) {
	if !checkFinanceRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili blagajnik mogu da evidentiraju članarinu"})
		return
	}

	var body struct {
		KorisnikID uint    `json:"korisnikId" binding:"required"`
		Iznos      float64 `json:"iznos" binding:"required"`
		Datum      string  `json:"datum" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno: korisnikId, iznos, datum"})
		return
	}
	if body.Iznos <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Iznos mora biti pozitivan"})
		return
	}
	datum, err := time.Parse("2006-01-02", body.Datum)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format datuma (YYYY-MM-DD)"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)

	var clan models.Korisnik
	if err := db.First(&clan, body.KorisnikID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	usernameVal, _ := c.Get("username")
	var ulogovan models.Korisnik
	if err := db.Where("username = ?", usernameVal).First(&ulogovan).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	clanID := body.KorisnikID
	t := models.Transakcija{
		Tip:                "uplata",
		Iznos:              body.Iznos,
		Opis:               "Članarina – " + clan.FullName,
		Datum:              datum,
		KorisnikID:         ulogovan.ID,
		ClanarinaKorisnikID: &clanID,
	}
	if err := db.Create(&t).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju članarine"})
		return
	}
	// Obaveštenje za admin i blagajnik
	var adminBlagajnikIDs []uint
	db.Model(&models.Korisnik{}).Where("role IN ?", []string{"admin", "blagajnik"}).Pluck("id", &adminBlagajnikIDs)
	notifications.NotifyUsers(db, adminBlagajnikIDs, models.ObavestenjeTipUplata, "Evidentirana nova uplata članarine", "Članarina – "+clan.FullName, "/finansije")
	c.JSON(http.StatusCreated, t)
}
