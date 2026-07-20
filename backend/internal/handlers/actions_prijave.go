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

	inviteToken := strings.TrimSpace(c.Query("inviteToken"))
	if inviteToken == "" {
		inviteToken = strings.TrimSpace(c.GetHeader("X-Action-Invite-Token"))
	}
	if inviteToken == "" {
		inviteToken = strings.TrimSpace(c.PostForm("inviteToken"))
	}
	if err := validateSignupAccess(db, &akcija, &korisnik, inviteToken); err != nil {
		if strings.Contains(err.Error(), "invite") || strings.Contains(err.Error(), "član") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Rani UX guard: ne šalji pending zahtjev ako je akcija već puna.
	// Ne rezerviše mjesto; race-safe kapacitet ostaje u accept flowu (LockAkcijaForUpdate).
	if err := helpers.EnsureCapacityAvailable(db, uint(akcijaID), akcija.MaxLjudi); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	choices := parseChoicesFromRequest(c)
	smestajJSON, _ := json.Marshal(choices.SelectedSmestajIDs)
	prevozJSON, _ := json.Marshal(choices.SelectedPrevozIDs)
	rentJSON, _ := json.Marshal(choices.SelectedRentItems)

	var signupReq models.ActionSignupRequest
	if err := db.Transaction(func(tx *gorm.DB) error {
		hasPrijava, err := helpers.HasPrijavaForUser(tx, uint(akcijaID), korisnik.ID)
		if err != nil {
			return err
		}
		if hasPrijava {
			return helpers.ErrDuplicatePrijava
		}
		hasPending, err := helpers.HasPendingSignupRequest(tx, uint(akcijaID), korisnik.ID)
		if err != nil {
			return err
		}
		if hasPending {
			return helpers.ErrPendingSignupExists
		}
		signupReq = models.ActionSignupRequest{
			AkcijaID:             uint(akcijaID),
			RequesterID:          korisnik.ID,
			Status:               models.ActionSignupRequestPending,
			SelectedSmestajIDs:   string(smestajJSON),
			SelectedPrevozIDs:    string(prevozJSON),
			SelectedRentItemsRaw: string(rentJSON),
		}
		if err := tx.Create(&signupReq).Error; err != nil {
			return helpers.MapCreateSignupRequestError(err)
		}
		return nil
	}); err != nil {
		if errors.Is(err, helpers.ErrDuplicatePrijava) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrPendingSignupExists) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri slanju zahteva", "details": err.Error()})
		return
	}

	signupReq.Akcija = akcija
	signupReq.Requester = korisnik
	createSignupRequestNotification(db, signupReq)

	saldo := computeSaldoForChoices(db, akcija, korisnik, choices)

	c.JSON(http.StatusOK, gin.H{
		"message":       "Zahtev za prijavu je poslat na odobrenje.",
		"akcijaId":      akcijaID,
		"signupRequest": gin.H{"id": signupReq.ID, "status": signupReq.Status},
		"saldo":         saldo,
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
	prijavaErr := db.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).First(&prijava).Error
	var signupReq models.ActionSignupRequest
	signupErr := db.Where("akcija_id = ? AND requester_id = ? AND status = ?", akcijaID, korisnik.ID, models.ActionSignupRequestPending).
		First(&signupReq).Error

	if prijavaErr != nil && signupErr != nil {
		c.JSON(200, gin.H{"prijava": nil, "signupRequest": nil})
		return
	}

	resp := gin.H{}
	if prijavaErr == nil {
		var izbor models.PrijavaIzbori
		selectedSmestaj := []uint{}
		selectedPrevoz := []uint{}
		selectedRent := []prijavaRentItem{}
		if err := db.Where("prijava_id = ?", prijava.ID).First(&izbor).Error; err == nil {
			_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selectedSmestaj)
			_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selectedPrevoz)
			_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selectedRent)
		}
		resp["prijava"] = gin.H{
			"id":                 prijava.ID,
			"status":             prijava.Status,
			"prijavljenAt":       prijava.PrijavljenAt,
			"selectedSmestajIds": selectedSmestaj,
			"selectedPrevozIds":  selectedPrevoz,
			"selectedRentItems":  selectedRent,
		}
	} else {
		resp["prijava"] = nil
	}

	if signupErr == nil {
		smestaj, prevoz, rent := parseSignupChoices(&signupReq)
		resp["signupRequest"] = gin.H{
			"id":                 signupReq.ID,
			"status":             signupReq.Status,
			"createdAt":          signupReq.CreatedAt,
			"selectedSmestajIds": smestaj,
			"selectedPrevozIds":  prevoz,
			"selectedRentItems":  rent,
		}
	} else {
		resp["signupRequest"] = nil
	}

	c.JSON(200, resp)
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
	if !akcijaZaPravo.PrikaziListuPrijavljenih {
		canSeePrijave = helpers.CanManageAkcijaEx(c, db, &akcijaZaPravo)
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
		saldo := computeSaldoForParticipant(db, akcijaZaPravo, p.Korisnik, selSmestaj, selPrevoz, selRent)
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
	}
	payload.SelectedRentItems = normalizeRentItems(payload.SelectedRentItems)
	if err := db.Transaction(func(tx *gorm.DB) error {
		exclude := prijava.ID
		if err := validateRentAvailability(tx, akcija.ID, payload.SelectedRentItems, &exclude); err != nil {
			return err
		}
		if err := validatePrevozCapacity(tx, akcija.ID, payload.SelectedPrevozIDs, &exclude); err != nil {
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
	saldo := computeSaldoForParticipant(db, akcija, korisnik, payload.SelectedSmestajIDs, payload.SelectedPrevozIDs, payload.SelectedRentItems)
	c.JSON(200, gin.H{
		"message":            "Izbori sačuvani",
		"saldo":              saldo,
		"selectedSmestajIds": payload.SelectedSmestajIDs,
		"selectedPrevozIds":  payload.SelectedPrevozIDs,
		"selectedRentItems":  payload.SelectedRentItems,
	})
}
