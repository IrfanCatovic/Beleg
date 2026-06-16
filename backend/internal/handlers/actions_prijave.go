package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func PrijaviNaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je već završena"})
		return
	}
	if !akcija.Javna {
		isClubMember := akcija.KlubID != nil && korisnik.KlubID != nil && *akcija.KlubID == *korisnik.KlubID
		if !isClubMember {
			inviteToken := strings.TrimSpace(c.Query("inviteToken"))
			if inviteToken == "" {
				inviteToken = strings.TrimSpace(c.GetHeader("X-Action-Invite-Token"))
			}
			if inviteToken == "" {
				inviteToken = strings.TrimSpace(c.PostForm("inviteToken"))
			}
			if !hasValidActionInviteLink(db, akcija.ID, inviteToken) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Za klupsku akciju morate biti član kluba ili imati važeći invite link."})
				return
			}
		}
	}
	if akcija.RokPrijava != nil {
		now := time.Now()
		deadline := time.Date(akcija.RokPrijava.Year(), akcija.RokPrijava.Month(), akcija.RokPrijava.Day(), 23, 59, 59, 0, akcija.RokPrijava.Location())
		if now.After(deadline) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Rok za prijavu je istekao"})
			return
		}
	}
	if akcija.MaxLjudi > 0 {
		var prijavljenih int64
		db.Model(&models.Prijava{}).Where("akcija_id = ? AND status = ?", akcijaID, "prijavljen").Count(&prijavljenih)
		if prijavljenih >= int64(akcija.MaxLjudi) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Maksimalan broj prijavljenih je popunjen"})
			return
		}
	}

	var count int64
	db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).
		Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Već ste prijavljeni za ovu akciju"})
		return
	}

	choices := prijavaChoicesPayload{}
	if strings.Contains(c.GetHeader("Content-Type"), "application/json") {
		_ = c.ShouldBindJSON(&choices)
	} else {
		if raw := strings.TrimSpace(c.PostForm("selectedSmestajIds")); raw != "" {
			_ = json.Unmarshal([]byte(raw), &choices.SelectedSmestajIDs)
		}
		if raw := strings.TrimSpace(c.PostForm("selectedPrevozIds")); raw != "" {
			_ = json.Unmarshal([]byte(raw), &choices.SelectedPrevozIDs)
		}
		if raw := strings.TrimSpace(c.PostForm("selectedRentItems")); raw != "" {
			_ = json.Unmarshal([]byte(raw), &choices.SelectedRentItems)
		}
	}
	choices.SelectedRentItems = normalizeRentItems(choices.SelectedRentItems)
	var prijava models.Prijava
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := validateRentAvailability(tx, uint(akcijaID), choices.SelectedRentItems, nil); err != nil {
			return err
		}
		prijava = models.Prijava{
			AkcijaID:   uint(akcijaID),
			KorisnikID: korisnik.ID,
		}
		if err := tx.Create(&prijava).Error; err != nil {
			return err
		}
		smestajJSON, _ := json.Marshal(choices.SelectedSmestajIDs)
		prevozJSON, _ := json.Marshal(choices.SelectedPrevozIDs)
		rentJSON, _ := json.Marshal(choices.SelectedRentItems)
		izbor := models.PrijavaIzbori{
			PrijavaID:            prijava.ID,
			SelectedSmestajIDs:   string(smestajJSON),
			SelectedPrevozIDs:    string(prevozJSON),
			SelectedRentItemsRaw: string(rentJSON),
		}
		return tx.Create(&izbor).Error
	}); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "rent opreme") || strings.Contains(errMsg, "Nedovoljno dostupne opreme") {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri prijavi", "details": errMsg})
		return
	}

	saldo := computeBaseCenaForUser(akcija, korisnik)
	if len(choices.SelectedSmestajIDs) > 0 {
		var picked []models.AkcijaSmestaj
		if err := db.Where("akcija_id = ? AND id IN ?", akcija.ID, choices.SelectedSmestajIDs).Find(&picked).Error; err == nil {
			for _, row := range picked {
				saldo += row.CenaPoOsobiUkupno
			}
		}
	}
	if len(choices.SelectedPrevozIDs) > 0 {
		var picked []models.AkcijaPrevoz
		if err := db.Where("akcija_id = ? AND id IN ?", akcija.ID, choices.SelectedPrevozIDs).Find(&picked).Error; err == nil {
			for _, row := range picked {
				saldo += row.CenaPoOsobi
			}
		}
	}
	for _, item := range choices.SelectedRentItems {
		if item.RentID == 0 || item.Kolicina <= 0 {
			continue
		}
		var rentRow models.AkcijaOpremaRent
		if err := db.Where("akcija_id = ? AND id = ?", akcija.ID, item.RentID).First(&rentRow).Error; err == nil {
			saldo += rentRow.CenaPoSetu * float64(item.Kolicina)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Uspešno ste se prijavili!",
		"akcijaId":     akcijaID,
		"prijavljenAt": prijava.PrijavljenAt,
		"saldo":        saldo,
	})
}

func GetMojaPrijavaZaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	var prijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).First(&prijava).Error; err != nil {
		c.JSON(200, gin.H{"prijava": nil})
		return
	}
	var izbor models.PrijavaIzbori
	selectedSmestaj := []uint{}
	selectedPrevoz := []uint{}
	selectedRent := []prijavaRentItem{}
	if err := db.Where("prijava_id = ?", prijava.ID).First(&izbor).Error; err == nil {
		_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selectedSmestaj)
		_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selectedPrevoz)
		_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selectedRent)
	}
	c.JSON(200, gin.H{
		"prijava": gin.H{
			"id":                 prijava.ID,
			"status":             prijava.Status,
			"prijavljenAt":       prijava.PrijavljenAt,
			"selectedSmestajIds": selectedSmestaj,
			"selectedPrevozIds":  selectedPrevoz,
			"selectedRentItems":  selectedRent,
		},
	})
}

func GetPrijaveZaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var akcijaZaPravo models.Akcija
	if err := db.First(&akcijaZaPravo, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	canSeePrijave := false
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if !akcijaZaPravo.PrikaziListuPrijavljenih {
		canSeePrijave = role == "vodic" || role == "admin" || role == "superadmin"
	} else if akcijaZaPravo.Javna {
		canSeePrijave = true
	} else if akcijaZaPravo.KlubID != nil {
		if viewerClubID, ok := helpers.GetEffectiveClubID(c, db); ok && viewerClubID == *akcijaZaPravo.KlubID {
			canSeePrijave = true
		}
	}
	if !canSeePrijave {
		username, exists := c.Get("username")
		if exists {
			var viewer models.Korisnik
			if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&viewer).Error; err == nil {
				if viewerCanAccessPrivateAkcija(db, &akcijaZaPravo, &viewer) {
					canSeePrijave = true
				}
			}
		}
	}
	if !canSeePrijave {
		c.JSON(http.StatusForbidden, gin.H{"error": "Spisak prijavljenih nije dostupan za ovu akciju"})
		return
	}

	var prijave []models.Prijava
	if err := db.Preload("Korisnik").Where("akcija_id = ?", id).Find(&prijave).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri čitanju prijava"})
		return
	}

	type PrijavaDTO struct {
		ID                 uint              `json:"id"`
		Korisnik           string            `json:"korisnik"`
		FullName           string            `json:"fullName"`
		AvatarURL          string            `json:"avatarUrl,omitempty"`
		IsProfiGuide       bool              `json:"isProfiGuide,omitempty"`
		PrijavljenAt       time.Time         `json:"prijavljenAt"`
		Status             string            `json:"status"`
		Platio             bool              `json:"platio"`
		SelectedSmestajIDs []uint            `json:"selectedSmestajIds"`
		SelectedPrevozIDs  []uint            `json:"selectedPrevozIds"`
		SelectedRentItems  []prijavaRentItem `json:"selectedRentItems"`
		Saldo              float64           `json:"saldo"`
		IsClanKluba        bool              `json:"isClanKluba"`
	}

	var smestajRows []models.AkcijaSmestaj
	_ = db.Where("akcija_id = ?", id).Find(&smestajRows).Error
	smestajByID := map[uint]float64{}
	for _, s := range smestajRows {
		smestajByID[s.ID] = s.CenaPoOsobiUkupno
	}
	var prevozRows []models.AkcijaPrevoz
	_ = db.Where("akcija_id = ?", id).Find(&prevozRows).Error
	prevozByID := map[uint]float64{}
	for _, p := range prevozRows {
		prevozByID[p.ID] = p.CenaPoOsobi
	}
	var rentRows []models.AkcijaOpremaRent
	_ = db.Where("akcija_id = ?", id).Find(&rentRows).Error
	rentByID := map[uint]float64{}
	for _, r := range rentRows {
		rentByID[r.ID] = r.CenaPoSetu
	}

	korisnikIDs := make([]uint, 0, len(prijave))
	for _, p := range prijave {
		if p.Korisnik.ID != 0 {
			korisnikIDs = append(korisnikIDs, p.Korisnik.ID)
		}
	}
	profiSet := helpers.ApprovedProfiGuideKorisnikIDs(db, korisnikIDs)

	var out []PrijavaDTO
	for _, p := range prijave {
		fullName := ""
		avatarURL := ""
		isProfi := false
		if p.Korisnik.ID != 0 {
			fullName = p.Korisnik.FullName
			avatarURL = p.Korisnik.AvatarURL
			isProfi = profiSet[p.Korisnik.ID]
		}
		selSmestaj := []uint{}
		selPrevoz := []uint{}
		selRent := []prijavaRentItem{}
		var izbor models.PrijavaIzbori
		if err := db.Where("prijava_id = ?", p.ID).First(&izbor).Error; err == nil {
			_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
			_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
			_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
		}
		isClan := false
		if p.Korisnik.ID != 0 && akcijaZaPravo.KlubID != nil && p.Korisnik.KlubID != nil && *p.Korisnik.KlubID == *akcijaZaPravo.KlubID {
			isClan = true
		}
		saldo := 0.0
		if isClan {
			saldo += akcijaZaPravo.CenaClan
		} else if akcijaZaPravo.Javna {
			saldo += akcijaZaPravo.CenaOstali
		} else {
			saldo += akcijaZaPravo.CenaClan
		}
		for _, sid := range selSmestaj {
			saldo += smestajByID[sid]
		}
		for _, pid := range selPrevoz {
			saldo += prevozByID[pid]
		}
		for _, item := range selRent {
			if item.Kolicina <= 0 {
				continue
			}
			saldo += rentByID[item.RentID] * float64(item.Kolicina)
		}
		out = append(out, PrijavaDTO{
			ID:                 p.ID,
			Korisnik:           p.Korisnik.Username,
			FullName:           fullName,
			AvatarURL:          avatarURL,
			IsProfiGuide:       isProfi,
			PrijavljenAt:       p.PrijavljenAt,
			Status:             p.Status,
			Platio:             p.Platio,
			SelectedSmestajIDs: selSmestaj,
			SelectedPrevozIDs:  selPrevoz,
			SelectedRentItems:  selRent,
			Saldo:              saldo,
			IsClanKluba:        isClan,
		})
	}

	c.JSON(200, gin.H{"prijave": out})
}

func UpdateMojaPrijavaIzbori(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	db := DB(c)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je već završena"})
		return
	}
	var prijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Niste prijavljeni na ovu akciju"})
		return
	}
	if prijava.Status != "prijavljen" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Ne možete menjati izbore nakon što je status potvrđen"})
		return
	}

	var payload prijavaChoicesPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}
	if len(payload.SelectedSmestajIDs) > 0 {
		var n int64
		db.Model(&models.AkcijaSmestaj{}).Where("akcija_id = ? AND id IN ?", akcija.ID, payload.SelectedSmestajIDs).Count(&n)
		if int(n) != len(payload.SelectedSmestajIDs) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID smeštaja"})
			return
		}
	}
	if len(payload.SelectedPrevozIDs) > 0 {
		var n int64
		db.Model(&models.AkcijaPrevoz{}).Where("akcija_id = ? AND id IN ?", akcija.ID, payload.SelectedPrevozIDs).Count(&n)
		if int(n) != len(payload.SelectedPrevozIDs) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prevoza"})
			return
		}
		for _, pid := range payload.SelectedPrevozIDs {
			var row models.AkcijaPrevoz
			if err := db.Where("akcija_id = ? AND id = ?", akcija.ID, pid).First(&row).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći prevoz"})
				return
			}
			if row.Kapacitet <= 0 {
				continue
			}
			var joined int64
			db.Table("prijava_izbori").
				Joins("JOIN prijave ON prijave.id = prijava_izbori.prijava_id").
				Where("prijave.akcija_id = ? AND prijava_izbori.prijava_id <> ? AND prijava_izbori.selected_prevoz_ids LIKE ?",
					akcija.ID, prijava.ID, "%"+strconv.FormatUint(uint64(pid), 10)+"%").
				Count(&joined)
			if joined >= int64(row.Kapacitet) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Prevoz '" + row.NazivGrupe + "' je pun"})
				return
			}
		}
	}
	payload.SelectedRentItems = normalizeRentItems(payload.SelectedRentItems)
	if err := db.Transaction(func(tx *gorm.DB) error {
		exclude := prijava.ID
		if err := validateRentAvailability(tx, akcija.ID, payload.SelectedRentItems, &exclude); err != nil {
			return err
		}
		smestajJSON, _ := json.Marshal(payload.SelectedSmestajIDs)
		prevozJSON, _ := json.Marshal(payload.SelectedPrevozIDs)
		rentJSON, _ := json.Marshal(payload.SelectedRentItems)
		var izbor models.PrijavaIzbori
		err = tx.Where("prijava_id = ?", prijava.ID).First(&izbor).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			izbor = models.PrijavaIzbori{
				PrijavaID:            prijava.ID,
				SelectedSmestajIDs:   string(smestajJSON),
				SelectedPrevozIDs:    string(prevozJSON),
				SelectedRentItemsRaw: string(rentJSON),
			}
			return tx.Create(&izbor).Error
		}
		if err != nil {
			return err
		}
		izbor.SelectedSmestajIDs = string(smestajJSON)
		izbor.SelectedPrevozIDs = string(prevozJSON)
		izbor.SelectedRentItemsRaw = string(rentJSON)
		return tx.Save(&izbor).Error
	}); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "rent opreme") || strings.Contains(errMsg, "Nedovoljno dostupne opreme") {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju izbora"})
		return
	}
	saldo := computeBaseCenaForUser(akcija, korisnik)
	for _, sid := range payload.SelectedSmestajIDs {
		var row models.AkcijaSmestaj
		if err := db.Where("akcija_id = ? AND id = ?", akcija.ID, sid).First(&row).Error; err == nil {
			saldo += row.CenaPoOsobiUkupno
		}
	}
	for _, pid := range payload.SelectedPrevozIDs {
		var row models.AkcijaPrevoz
		if err := db.Where("akcija_id = ? AND id = ?", akcija.ID, pid).First(&row).Error; err == nil {
			saldo += row.CenaPoOsobi
		}
	}
	for _, item := range payload.SelectedRentItems {
		if item.RentID == 0 || item.Kolicina <= 0 {
			continue
		}
		var row models.AkcijaOpremaRent
		if err := db.Where("akcija_id = ? AND id = ?", akcija.ID, item.RentID).First(&row).Error; err == nil {
			saldo += row.CenaPoSetu * float64(item.Kolicina)
		}
	}
	c.JSON(200, gin.H{
		"message":            "Izbori sačuvani",
		"saldo":              saldo,
		"selectedSmestajIds": payload.SelectedSmestajIDs,
		"selectedPrevozIds":  payload.SelectedPrevozIDs,
		"selectedRentItems":  payload.SelectedRentItems,
	})
}
