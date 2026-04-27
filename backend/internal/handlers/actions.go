package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/middleware"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var allowedTezine = map[string]bool{"lako": true, "srednje": true, "tesko": true, "alpinizam": true}

func isValidTezina(tezina string) bool {
	return allowedTezine[strings.TrimSpace(strings.ToLower(tezina))]
}

func notifySummitReward(db *gorm.DB, userID uint, akcija models.Akcija) {
	if userID == 0 || akcija.ID == 0 {
		return
	}
	actionName := strings.TrimSpace(akcija.Naziv)
	if actionName == "" {
		actionName = "akciju"
	}
	title := "Čestitamo!"
	body := fmt.Sprintf("Uspešno ste popeli akciju %s", actionName)
	metadataBytes, err := json.Marshal(map[string]interface{}{
		"akcijaId":    akcija.ID,
		"akcijaNaziv": actionName,
	})
	if err != nil {
		metadataBytes = []byte(fmt.Sprintf(`{"akcijaId":%d}`, akcija.ID))
	}
	notifications.NotifyUsers(
		db,
		[]uint{userID},
		models.ObavestenjeTipSummitReward,
		title,
		body,
		fmt.Sprintf("/akcije/%d?claimReward=1", akcija.ID),
		string(metadataBytes),
	)
}

type createSmestajItem struct {
	Naziv             string  `json:"naziv"`
	CenaPoOsobiUkupno float64 `json:"cenaPoOsobiUkupno"`
	Opis              string  `json:"opis"`
}

type createOpremaItem struct {
	Naziv            string  `json:"naziv"`
	DostupnaKolicina int     `json:"dostupnaKolicina"`
	CenaPoSetu       float64 `json:"cenaPoSetu"`
}

type createPrevozItem struct {
	TipPrevoza  string  `json:"tipPrevoza"`
	NazivGrupe  string  `json:"nazivGrupe"`
	Kapacitet   int     `json:"kapacitet"`
	CenaPoOsobi float64 `json:"cenaPoOsobi"`
}

type prijavaRentItem struct {
	RentID   uint `json:"rentId"`
	Kolicina int  `json:"kolicina"`
}

type prijavaChoicesPayload struct {
	SelectedSmestajIDs []uint            `json:"selectedSmestajIds"`
	SelectedPrevozIDs  []uint            `json:"selectedPrevozIds"`
	SelectedRentItems  []prijavaRentItem `json:"selectedRentItems"`
}

func normalizeRentItems(items []prijavaRentItem) []prijavaRentItem {
	if len(items) == 0 {
		return nil
	}
	byRent := make(map[uint]int, len(items))
	for _, item := range items {
		if item.RentID == 0 || item.Kolicina <= 0 {
			continue
		}
		byRent[item.RentID] += item.Kolicina
	}
	out := make([]prijavaRentItem, 0, len(byRent))
	for rentID, qty := range byRent {
		if qty > 0 {
			out = append(out, prijavaRentItem{RentID: rentID, Kolicina: qty})
		}
	}
	return out
}

func loadReservedRentByAction(db *gorm.DB, akcijaID uint, excludePrijavaID *uint) (map[uint]int, error) {
	type rentRawRow struct {
		SelectedRentItemsRaw string `gorm:"column:selected_rent_items_raw"`
	}
	q := db.Table("prijava_izbori").
		Select("prijava_izbori.selected_rent_items_raw").
		Joins("JOIN prijave ON prijave.id = prijava_izbori.prijava_id").
		Where("prijave.akcija_id = ? AND prijave.status = ?", akcijaID, "prijavljen")
	if excludePrijavaID != nil {
		q = q.Where("prijava_izbori.prijava_id <> ?", *excludePrijavaID)
	}
	var rows []rentRawRow
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	reserved := map[uint]int{}
	for _, row := range rows {
		if strings.TrimSpace(row.SelectedRentItemsRaw) == "" {
			continue
		}
		var items []prijavaRentItem
		if err := json.Unmarshal([]byte(row.SelectedRentItemsRaw), &items); err != nil {
			continue
		}
		for _, item := range items {
			if item.RentID == 0 || item.Kolicina <= 0 {
				continue
			}
			reserved[item.RentID] += item.Kolicina
		}
	}
	return reserved, nil
}

func validateRentAvailability(db *gorm.DB, akcijaID uint, requested []prijavaRentItem, excludePrijavaID *uint) error {
	requested = normalizeRentItems(requested)
	if len(requested) == 0 {
		return nil
	}
	var rentRows []models.AkcijaOpremaRent
	if err := db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("akcija_id = ?", akcijaID).
		Find(&rentRows).Error; err != nil {
		return err
	}
	stockByID := make(map[uint]models.AkcijaOpremaRent, len(rentRows))
	for _, row := range rentRows {
		stockByID[row.ID] = row
	}
	reservedByID, err := loadReservedRentByAction(db, akcijaID, excludePrijavaID)
	if err != nil {
		return err
	}
	for _, item := range requested {
		row, ok := stockByID[item.RentID]
		if !ok {
			return errors.New("Nevažeći ID rent opreme")
		}
		remaining := row.DostupnaKolicina - reservedByID[item.RentID]
		if remaining < 0 {
			remaining = 0
		}
		if item.Kolicina > remaining {
			return errors.New("Nedovoljno dostupne opreme: " + row.NazivOpreme)
		}
	}
	return nil
}

func parseBoolWithDefault(raw string, fallback bool) bool {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return fallback
	}
	return raw == "true" || raw == "1"
}

func parseActionExtras(c *gin.Context, akcija *models.Akcija) (bool, string) {
	tipAkcije := strings.TrimSpace(strings.ToLower(c.PostForm("tipAkcije")))
	if tipAkcije == "" {
		tipAkcije = "planina"
	}
	if tipAkcije != "planina" && tipAkcije != "via_ferrata" {
		return false, "Tip akcije mora biti planina ili via_ferrata"
	}
	akcija.TipAkcije = tipAkcije

	if raw := strings.TrimSpace(c.PostForm("trajanjeSati")); raw != "" {
		val, err := strconv.ParseFloat(raw, 64)
		if err != nil || val <= 0 {
			return false, "Trajanje sati mora biti pozitivan broj"
		}
		akcija.TrajanjeSati = val
	}

	if raw := strings.TrimSpace(c.PostForm("rokPrijava")); raw != "" {
		rok, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return false, "Rok prijava mora biti YYYY-MM-DD"
		}
		akcija.RokPrijava = &rok
	} else {
		akcija.RokPrijava = nil
	}

	if raw := strings.TrimSpace(c.PostForm("maxLjudi")); raw != "" {
		val, err := strconv.Atoi(raw)
		if err != nil || val < 0 {
			return false, "Max broj ljudi mora biti ceo broj >= 0"
		}
		akcija.MaxLjudi = val
	}

	akcija.MestoPolaska = strings.TrimSpace(c.PostForm("mestoPolaska"))
	akcija.KontaktTelefon = strings.TrimSpace(c.PostForm("kontaktTelefon"))

	if raw := strings.TrimSpace(c.PostForm("brojDana")); raw != "" {
		val, err := strconv.Atoi(raw)
		if err != nil || val < 1 {
			return false, "Broj dana mora biti ceo broj >= 1"
		}
		akcija.BrojDana = val
	}
	if akcija.BrojDana == 0 {
		akcija.BrojDana = 1
	}

	if raw := strings.TrimSpace(c.PostForm("cenaClan")); raw != "" {
		val, err := strconv.ParseFloat(raw, 64)
		if err != nil || val < 0 {
			return false, "Cena za članove mora biti broj >= 0"
		}
		akcija.CenaClan = val
	}
	if raw := strings.TrimSpace(c.PostForm("cenaOstali")); raw != "" {
		val, err := strconv.ParseFloat(raw, 64)
		if err != nil || val < 0 {
			return false, "Cena za ostale mora biti broj >= 0"
		}
		akcija.CenaOstali = val
	}

	akcija.PrikaziListuPrijavljenih = parseBoolWithDefault(c.PostForm("prikaziListuPrijavljenih"), true)
	akcija.OmoguciGrupniChat = parseBoolWithDefault(c.PostForm("omoguciGrupniChat"), false)

	if akcija.RokPrijava != nil && akcija.RokPrijava.After(akcija.Datum) {
		return false, "Rok prijava ne može biti nakon datuma akcije"
	}
	return true, ""
}

func syncActionNestedData(db *gorm.DB, akcijaID uint, c *gin.Context) error {
	smestajRaw := strings.TrimSpace(c.PostForm("smestajJson"))
	opremaRaw := strings.TrimSpace(c.PostForm("opremaJson"))
	prevozRaw := strings.TrimSpace(c.PostForm("prevozJson"))

	if err := db.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaSmestaj{}).Error; err != nil {
		return err
	}
	if err := db.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaOpremaRent{}).Error; err != nil {
		return err
	}
	if err := db.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaOprema{}).Error; err != nil {
		return err
	}
	if err := db.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaPrevoz{}).Error; err != nil {
		return err
	}

	if smestajRaw != "" {
		var smestajItems []createSmestajItem
		if err := json.Unmarshal([]byte(smestajRaw), &smestajItems); err != nil {
			return fmt.Errorf("nevažeći smestajJson: %w", err)
		}
		for _, s := range smestajItems {
			if strings.TrimSpace(s.Naziv) == "" {
				continue
			}
			if s.CenaPoOsobiUkupno < 0 {
				return errors.New("cena smeštaja ne može biti negativna")
			}
			row := models.AkcijaSmestaj{
				AkcijaID:          akcijaID,
				Naziv:             strings.TrimSpace(s.Naziv),
				CenaPoOsobiUkupno: s.CenaPoOsobiUkupno,
				Opis:              strings.TrimSpace(s.Opis),
			}
			if err := db.Create(&row).Error; err != nil {
				return err
			}
		}
	}

	if opremaRaw != "" {
		var opremaItems []createOpremaItem
		if err := json.Unmarshal([]byte(opremaRaw), &opremaItems); err != nil {
			return fmt.Errorf("nevažeći opremaJson: %w", err)
		}
		for _, o := range opremaItems {
			name := strings.TrimSpace(o.Naziv)
			if name == "" {
				continue
			}
			if o.DostupnaKolicina < 0 || o.CenaPoSetu < 0 {
				return errors.New("količina i cena rent opreme moraju biti >= 0")
			}
			opremaRow := models.AkcijaOprema{
				AkcijaID: akcijaID,
				Naziv:    name,
				Obavezna: true,
			}
			if err := db.Create(&opremaRow).Error; err != nil {
				return err
			}
			if o.DostupnaKolicina > 0 || o.CenaPoSetu > 0 {
				rentRow := models.AkcijaOpremaRent{
					AkcijaID:         akcijaID,
					AkcijaOpremaID:   &opremaRow.ID,
					NazivOpreme:      name,
					DostupnaKolicina: o.DostupnaKolicina,
					CenaPoSetu:       o.CenaPoSetu,
				}
				if err := db.Create(&rentRow).Error; err != nil {
					return err
				}
			}
		}
	}

	if prevozRaw != "" {
		var prevozItems []createPrevozItem
		if err := json.Unmarshal([]byte(prevozRaw), &prevozItems); err != nil {
			return fmt.Errorf("nevažeći prevozJson: %w", err)
		}
		for _, p := range prevozItems {
			if strings.TrimSpace(p.TipPrevoza) == "" || strings.TrimSpace(p.NazivGrupe) == "" {
				continue
			}
			if p.Kapacitet < 0 || p.CenaPoOsobi < 0 {
				return errors.New("kapacitet i cena prevoza moraju biti >= 0")
			}
			row := models.AkcijaPrevoz{
				AkcijaID:    akcijaID,
				TipPrevoza:  strings.TrimSpace(p.TipPrevoza),
				NazivGrupe:  strings.TrimSpace(p.NazivGrupe),
				Kapacitet:   p.Kapacitet,
				CenaPoOsobi: p.CenaPoOsobi,
			}
			if err := db.Create(&row).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func computeBaseCenaForUser(akcija models.Akcija, korisnik models.Korisnik) float64 {
	if akcija.KlubID != nil && korisnik.KlubID != nil && *akcija.KlubID == *korisnik.KlubID {
		return akcija.CenaClan
	}
	if akcija.Javna {
		return akcija.CenaOstali
	}
	return akcija.CenaClan
}

func GetPublicAkcijaByID(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
			return
		}
		dbAny, _ := c.Get("db")
		db := dbAny.(*gorm.DB)
		var akcija models.Akcija
		if err := db.First(&akcija, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Akcija nije pronađena"})
			return
		}

		canSeePrivateDetails := akcija.Javna
		var viewer *models.Korisnik
		if !akcija.Javna && akcija.KlubID != nil {
			if hasValidActionInviteLink(db, akcija.ID, c.Query("inviteToken")) {
				canSeePrivateDetails = true
			}
			tokenStr := middleware.GetTokenFromRequest(c)
			if tokenStr != "" {
				claims := jwt.MapClaims{}
				if token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
					if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, jwt.ErrSignatureInvalid
					}
					return jwtSecret, nil
				}); err == nil && token.Valid {
					usernameClaim, _ := claims["username"].(string)
					roleClaim, _ := claims["role"].(string)
					usernameClaim = strings.TrimSpace(usernameClaim)
					if usernameClaim != "" {
						var viewerUser models.Korisnik
						if err := helpers.DBWhereUsername(db, usernameClaim).First(&viewerUser).Error; err == nil {
							viewer = &viewerUser
							if viewerUser.KlubID != nil && *viewerUser.KlubID == *akcija.KlubID {
								canSeePrivateDetails = true
							}
							if roleClaim == "superadmin" {
								if selectedClubID, err := strconv.ParseUint(strings.TrimSpace(c.GetHeader("X-Club-Id")), 10, 64); err == nil && uint(selectedClubID) == *akcija.KlubID {
									canSeePrivateDetails = true
								}
							}
						}
					}
				}
			}
		}

		if !canSeePrivateDetails {
			limited := gin.H{
				"id":          akcija.ID,
				"naziv":       akcija.Naziv,
				"planina":     akcija.Planina,
				"vrh":         akcija.Vrh,
				"datum":       akcija.Datum,
				"isCompleted": akcija.IsCompleted,
				"createdAt":   akcija.CreatedAt,
				"updatedAt":   akcija.UpdatedAt,
				"javna":       akcija.Javna,
				"limited":     true,
			}
			if akcija.KlubID != nil {
				limited["klubId"] = *akcija.KlubID
			}
			c.JSON(200, limited)
			return
		}

		resp := gin.H{
			"id": akcija.ID, "naziv": akcija.Naziv, "planina": akcija.Planina, "vrh": akcija.Vrh, "datum": akcija.Datum,
			"opis": akcija.Opis, "tezina": akcija.Tezina, "slikaUrl": akcija.SlikaURL,
			"createdAt": akcija.CreatedAt, "updatedAt": akcija.UpdatedAt,
			"isCompleted": akcija.IsCompleted, "kumulativniUsponM": akcija.UkupnoMetaraUsponaAkcija,
			"duzinaStazeKm": akcija.UkupnoKmAkcija, "visinaVrhM": akcija.VisinaVrhM, "zimskiUspon": akcija.ZimskiUspon,
			"vodicId":       akcija.VodicID,
			"drugiVodicIme": akcija.DrugiVodicIme, "addedById": akcija.AddedByID,
			"javna":                    akcija.Javna,
			"tipAkcije":                akcija.TipAkcije,
			"trajanjeSati":             akcija.TrajanjeSati,
			"rokPrijava":               akcija.RokPrijava,
			"maxLjudi":                 akcija.MaxLjudi,
			"mestoPolaska":             akcija.MestoPolaska,
			"kontaktTelefon":           akcija.KontaktTelefon,
			"brojDana":                 akcija.BrojDana,
			"cenaClan":                 akcija.CenaClan,
			"cenaOstali":               akcija.CenaOstali,
			"prikaziListuPrijavljenih": akcija.PrikaziListuPrijavljenih,
			"omoguciGrupniChat":        akcija.OmoguciGrupniChat,
		}
		if akcija.KlubID != nil {
			resp["klubId"] = *akcija.KlubID
		}
		if akcija.Javna && akcija.KlubID != nil {
			var klub models.Klubovi
			if db.First(&klub, *akcija.KlubID).Error == nil {
				resp["klubNaziv"] = klub.Naziv
			}
		}
		if akcija.VodicID > 0 {
			var v models.Korisnik
			if db.First(&v, akcija.VodicID).Error == nil {
				resp["vodic"] = gin.H{"fullName": v.FullName, "username": v.Username}
			}
		}
		if akcija.AddedByID > 0 {
			var a models.Korisnik
			if db.First(&a, akcija.AddedByID).Error == nil {
				resp["addedBy"] = gin.H{"fullName": a.FullName, "username": a.Username}
			}
		}
		var prijaveCount int64
		db.Model(&models.Prijava{}).Where("akcija_id = ?", id).Count(&prijaveCount)
		resp["prijaveCount"] = prijaveCount

		var smestaj []models.AkcijaSmestaj
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&smestaj).Error
		var oprema []models.AkcijaOprema
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&oprema).Error
		var rent []models.AkcijaOpremaRent
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&rent).Error
		reservedByRentID, _ := loadReservedRentByAction(db, akcija.ID, nil)
		for i := range rent {
			remaining := rent[i].DostupnaKolicina - reservedByRentID[rent[i].ID]
			if remaining < 0 {
				remaining = 0
			}
			rent[i].DostupnaKolicina = remaining
		}
		var prevoz []models.AkcijaPrevoz
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&prevoz).Error
		resp["smestaj"] = smestaj
		resp["oprema"] = oprema
		resp["opremaRent"] = rent
		resp["prevoz"] = prevoz

		if viewer != nil {
			isClan := false
			if akcija.KlubID != nil && viewer.KlubID != nil && *viewer.KlubID == *akcija.KlubID {
				isClan = true
			}
			resp["isClanKluba"] = isClan
			saldo := computeBaseCenaForUser(akcija, *viewer)
			var moja models.Prijava
			if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, viewer.ID).First(&moja).Error; err == nil {
				var izbor models.PrijavaIzbori
				if err := db.Where("prijava_id = ?", moja.ID).First(&izbor).Error; err == nil {
					var smestajIDs []uint
					var prevozIDs []uint
					var rentItems []prijavaRentItem
					_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &smestajIDs)
					_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &prevozIDs)
					_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &rentItems)
					if len(smestajIDs) > 0 {
						var picked []models.AkcijaSmestaj
						if err := db.Where("akcija_id = ? AND id IN ?", akcija.ID, smestajIDs).Find(&picked).Error; err == nil {
							for _, row := range picked {
								saldo += row.CenaPoOsobiUkupno
							}
						}
					}
					if len(prevozIDs) > 0 {
						var picked []models.AkcijaPrevoz
						if err := db.Where("akcija_id = ? AND id IN ?", akcija.ID, prevozIDs).Find(&picked).Error; err == nil {
							for _, row := range picked {
								saldo += row.CenaPoOsobi
							}
						}
					}
					for _, item := range rentItems {
						if item.RentID == 0 || item.Kolicina <= 0 {
							continue
						}
						var row models.AkcijaOpremaRent
						if err := db.Where("akcija_id = ? AND id = ?", akcija.ID, item.RentID).First(&row).Error; err == nil {
							saldo += row.CenaPoSetu * float64(item.Kolicina)
						}
					}
				}
			}
			resp["mojSaldo"] = saldo
		}
		c.JSON(200, resp)
	}
}

func GetAkcije(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	gormDb := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, gormDb)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi.", "aktivne": []models.Akcija{}, "zavrsene": []models.Akcija{}})
		return
	}
	if clubID == 0 {
		var aktivne []models.Akcija
		where := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND javna = ?"
		if err := gormDb.Preload("Klub").Where(where, false, true, true).Find(&aktivne).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
			return
		}
		for i := range aktivne {
			if aktivne[i].Klub != nil {
				aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
				aktivne[i].KlubLogoURL = aktivne[i].Klub.LogoURL
			}
		}
		c.JSON(http.StatusOK, gin.H{"aktivne": aktivne, "zavrsene": []models.Akcija{}})
		return
	}

	if strings.EqualFold(strings.TrimSpace(c.Query("scope")), "global") {
		var aktivne []models.Akcija
		where := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND javna = ?"
		if err := gormDb.Preload("Klub").Where(where, false, true, true).Find(&aktivne).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
			return
		}
		for i := range aktivne {
			if aktivne[i].Klub != nil {
				aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
				aktivne[i].KlubLogoURL = aktivne[i].Klub.LogoURL
			}
		}
		c.JSON(http.StatusOK, gin.H{"aktivne": aktivne, "zavrsene": []models.Akcija{}})
		return
	}

	var aktivne []models.Akcija
	var zavrsene []models.Akcija
	aktivneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND (klub_id = ? OR javna = ?)"
	if err := gormDb.Preload("Klub").Where(aktivneWhere, false, true, clubID, true).Find(&aktivne).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
		return
	}
	zavrseneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND klub_id = ?"
	if err := gormDb.Preload("Klub").Where(zavrseneWhere, true, true, clubID).Find(&zavrsene).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju završenih akcija"})
		return
	}
	for i := range aktivne {
		if aktivne[i].Klub != nil {
			aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
			aktivne[i].KlubLogoURL = aktivne[i].Klub.LogoURL
		}
	}
	for i := range zavrsene {
		if zavrsene[i].Klub != nil {
			zavrsene[i].KlubNaziv = zavrsene[i].Klub.Naziv
			zavrsene[i].KlubLogoURL = zavrsene[i].Klub.LogoURL
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"aktivne":  aktivne,
		"zavrsene": zavrsene,
	})
}

func CreateAkcija(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič mogu dodavati akcije"})
		return
	}
	username, _ := c.Get("username")
	db := c.MustGet("db").(*gorm.DB)
	var currentUser models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&currentUser).Error; err != nil {
		c.JSON(500, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok || clubID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (superadmin) ili niste u klubu."})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeća forma"})
		return
	}

	naziv := c.PostForm("naziv")
	planina := strings.TrimSpace(c.PostForm("planina"))
	vrh := c.PostForm("vrh")
	datumStr := c.PostForm("datum")
	opis := c.PostForm("opis")
	tezina := c.PostForm("tezina")
	kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
	duzinaStazeKmStr := c.PostForm("duzinaStazeKm")
	visinaVrhMStr := c.PostForm("visinaVrhM")
	zimskiUsponStr := c.PostForm("zimskiUspon")
	vodicIDStr := c.PostForm("vodic_id")
	drugiVodicIme := c.PostForm("drugi_vodic_ime")
	javna := strings.ToLower(strings.TrimSpace(c.PostForm("javna"))) == "true"

	if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
		c.JSON(400, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
		return
	}
	if !isValidTezina(tezina) {
		c.JSON(400, gin.H{"error": "Izaberi težinu od ponuđenih"})
		return
	}

	datum, err := time.Parse("2006-01-02", datumStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Datum mora biti YYYY-MM-DD"})
		return
	}

	kumulativniUsponM, err := strconv.Atoi(kumulativniUsponMStr)
	if err != nil || kumulativniUsponM < 0 {
		c.JSON(400, gin.H{"error": "Kumulativni uspon mora biti ceo pozitivan broj (metri)"})
		return
	}

	duzinaStazeKm, err := strconv.ParseFloat(duzinaStazeKmStr, 64)
	if err != nil || duzinaStazeKm < 0 {
		c.JSON(400, gin.H{"error": "Dužina staze mora biti pozitivan broj (km)"})
		return
	}

	var visinaVrhM int
	if strings.TrimSpace(visinaVrhMStr) != "" {
		visinaVrhM, err = strconv.Atoi(visinaVrhMStr)
		if err != nil || visinaVrhM < 0 {
			c.JSON(400, gin.H{"error": "Visina vrha mora biti ceo pozitivan broj (metri)"})
			return
		}
	}

	zimskiUspon := strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"

	var vodicID uint
	if vodicIDStr != "" {
		if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
			vodicID = uint(vID)
		}
	}

	akcija := models.Akcija{
		Naziv:                    naziv,
		Planina:                  planina,
		Vrh:                      vrh,
		Datum:                    datum,
		Opis:                     opis,
		Tezina:                   tezina,
		UkupnoMetaraUsponaAkcija: kumulativniUsponM,
		UkupnoKmAkcija:           duzinaStazeKm,
		VisinaVrhM:               visinaVrhM,
		ZimskiUspon:              zimskiUspon,
		SlikaURL:                 "",
		IsCompleted:              false,
		UIstorijiKluba:           true,
		Javna:                    javna,
		KlubID:                   &clubID,
		VodicID:                  vodicID,
		DrugiVodicIme:            strings.TrimSpace(drugiVodicIme),
		AddedByID:                currentUser.ID,
		TipAkcije:                "planina",
		BrojDana:                 1,
		PrikaziListuPrijavljenih: true,
	}
	if ok, errMsg := parseActionExtras(c, &akcija); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	if err := db.Create(&akcija).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri čuvanju akcije"})
		return
	}
	if err := syncActionNestedData(db, akcija.ID, c); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var notifyUserIDs []uint
	if javna {
		db.Model(&models.Korisnik{}).Where("klub_id IS NOT NULL").Pluck("id", &notifyUserIDs)
	} else {
		db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Pluck("id", &notifyUserIDs)
	}
	notifications.NotifyUsers(db, notifyUserIDs, models.ObavestenjeTipAkcija, "Nova akcija u kalendaru", akcija.Naziv, "/akcije/"+strconv.Itoa(int(akcija.ID)), fmt.Sprintf(`{"akcijaId":%d}`, akcija.ID))

	files := form.File["slika"]
	if len(files) > 0 {
		file := files[0]
		if err := helpers.ValidateImageFileHeader(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna slika akcije: " + err.Error()})
			return
		}
		clubIDForFolder := uint(0)
		if akcija.KlubID != nil {
			clubIDForFolder = *akcija.KlubID
		}
		if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		f, err := file.Open()
		if err != nil {
			c.JSON(500, gin.H{"error": "Greška pri čitanju fajla"})
			return
		}
		defer f.Close()

		cld, err := cloudinary.NewFromParams(
			os.Getenv("CLOUDINARY_CLOUD_NAME"),
			os.Getenv("CLOUDINARY_API_KEY"),
			os.Getenv("CLOUDINARY_API_SECRET"),
		)
		if err != nil {
			c.JSON(500, gin.H{"error": "Greška pri inicijalizaciji Cloudinary-ja"})
			return
		}

		ctx := context.Background()
		uploadParams := uploader.UploadParams{
			PublicID:       fmt.Sprintf("akcije/%d", akcija.ID),
			Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
			Transformation: "q_auto:good,f_auto",
		}

		uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
		if err != nil {
			c.JSON(500, gin.H{"error": "Greška pri upload-u na Cloudinary: " + err.Error()})
			return
		}
		helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
		akcija.SlikaURL = uploadResult.SecureURL
		db.Save(&akcija)
	}

	resp := gin.H{
		"message": "Akcija dodata",
		"akcija":  akcija,
	}
	if !akcija.Javna {
		if rawToken, err := createActionInviteLinkForAkcija(db, akcija); err == nil {
			resp["inviteToken"] = rawToken
			resp["inviteUrl"] = fmt.Sprintf("%s/akcije/%d?inviteToken=%s", actionInvitePublicBaseURL(), akcija.ID, rawToken)
		}
	}

	c.JSON(201, resp)
}

func UpdateAkcija(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može izmeniti akciju"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je menja"})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća forma"})
		return
	}

	naziv := c.PostForm("naziv")
	planina := strings.TrimSpace(c.PostForm("planina"))
	vrh := c.PostForm("vrh")
	datumStr := c.PostForm("datum")
	opis := c.PostForm("opis")
	tezina := c.PostForm("tezina")
	kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
	duzinaStazeKmStr := c.PostForm("duzinaStazeKm")
	visinaVrhMStr := c.PostForm("visinaVrhM")
	zimskiUsponStr := c.PostForm("zimskiUspon")
	vodicIDStr := c.PostForm("vodic_id")
	drugiVodicIme := c.PostForm("drugi_vodic_ime")
	if rawJavna := c.PostForm("javna"); rawJavna != "" {
		akcija.Javna = strings.ToLower(strings.TrimSpace(rawJavna)) == "true"
	}

	if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
		return
	}
	if !isValidTezina(tezina) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberi težinu od ponuđenih"})
		return
	}

	datum, err := time.Parse("2006-01-02", datumStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datum mora biti YYYY-MM-DD"})
		return
	}

	kumulativniUsponM, err := strconv.Atoi(kumulativniUsponMStr)
	if err != nil || kumulativniUsponM < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kumulativni uspon mora biti ceo pozitivan broj (metri)"})
		return
	}

	duzinaStazeKm, err := strconv.ParseFloat(duzinaStazeKmStr, 64)
	if err != nil || duzinaStazeKm < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dužina staze mora biti pozitivan broj (km)"})
		return
	}

	if strings.TrimSpace(visinaVrhMStr) != "" {
		visinaVrhM, err := strconv.Atoi(visinaVrhMStr)
		if err != nil || visinaVrhM < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Visina vrha mora biti ceo pozitivan broj (metri)"})
			return
		}
		akcija.VisinaVrhM = visinaVrhM
	}

	if strings.TrimSpace(zimskiUsponStr) != "" {
		akcija.ZimskiUspon = strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"
	}

	var vodicID uint
	if vodicIDStr != "" {
		if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
			vodicID = uint(vID)
		}
	}

	akcija.Naziv = naziv
	akcija.Planina = planina
	akcija.Vrh = vrh
	akcija.Datum = datum
	akcija.Opis = opis
	akcija.Tezina = tezina
	akcija.UkupnoMetaraUsponaAkcija = kumulativniUsponM
	akcija.UkupnoKmAkcija = duzinaStazeKm
	akcija.VodicID = vodicID
	akcija.DrugiVodicIme = strings.TrimSpace(drugiVodicIme)
	if ok, errMsg := parseActionExtras(c, &akcija); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	if err := db.Save(&akcija).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju akcije"})
		return
	}
	if err := syncActionNestedData(db, akcija.ID, c); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	files := form.File["slika"]
	if len(files) > 0 {
		file := files[0]
		if err := helpers.ValidateImageFileHeader(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna slika akcije: " + err.Error()})
			return
		}
		clubIDForFolder := uint(0)
		if akcija.KlubID != nil {
			clubIDForFolder = *akcija.KlubID
		}
		if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
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
			PublicID:       fmt.Sprintf("akcije/%d", akcija.ID),
			Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
			Transformation: "q_auto:good,f_auto",
		}

		uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u na Cloudinary: " + err.Error()})
			return
		}
		helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
		helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), akcija.SlikaURL)
		akcija.SlikaURL = uploadResult.SecureURL
		db.Save(&akcija)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Akcija uspešno ažurirana",
		"akcija":  akcija,
	})
}

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

	var out []PrijavaDTO
	for _, p := range prijave {
		fullName := ""
		avatarURL := ""
		if p.Korisnik.ID != 0 {
			fullName = p.Korisnik.FullName
			avatarURL = p.Korisnik.AvatarURL
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
	db := c.MustGet("db").(*gorm.DB)
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

func DodajPrevozZaAkciju(c *gin.Context) {
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
	db := c.MustGet("db").(*gorm.DB)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je završena"})
		return
	}
	isHost := helpers.CanManageAkcija(c, db, akcija.KlubID)
	if !isHost {
		var count int64
		db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ? AND status = ?", akcija.ID, korisnik.ID, "prijavljen").Count(&count)
		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Samo prijavljeni članovi mogu dodati novi prevoz"})
			return
		}
	}

	var req struct {
		TipPrevoza  string  `json:"tipPrevoza"`
		NazivGrupe  string  `json:"nazivGrupe"`
		Kapacitet   int     `json:"kapacitet"`
		CenaPoOsobi float64 `json:"cenaPoOsobi"`
		Join        bool    `json:"join"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}
	naziv := strings.TrimSpace(req.NazivGrupe)
	tip := strings.TrimSpace(req.TipPrevoza)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv grupe je obavezan"})
		return
	}
	if tip == "" {
		tip = "auto"
	}
	if req.Kapacitet < 1 || req.Kapacitet > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kapacitet mora biti između 1 i 50"})
		return
	}
	if req.CenaPoOsobi < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cena ne sme biti negativna"})
		return
	}
	row := models.AkcijaPrevoz{
		AkcijaID:    akcija.ID,
		TipPrevoza:  tip,
		NazivGrupe:  naziv,
		Kapacitet:   req.Kapacitet,
		CenaPoOsobi: req.CenaPoOsobi,
	}
	if err := db.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju prevoza"})
		return
	}

	if req.Join {
		var prijava models.Prijava
		if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error; err == nil {
			var izbor models.PrijavaIzbori
			selSmestaj := []uint{}
			selPrevoz := []uint{}
			selRent := []prijavaRentItem{}
			if err := db.Where("prijava_id = ?", prijava.ID).First(&izbor).Error; err == nil {
				_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
				_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
				_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
			}
			selPrevoz = append(selPrevoz, row.ID)
			smJSON, _ := json.Marshal(selSmestaj)
			prJSON, _ := json.Marshal(selPrevoz)
			reJSON, _ := json.Marshal(selRent)
			if izbor.ID == 0 {
				izbor = models.PrijavaIzbori{
					PrijavaID:            prijava.ID,
					SelectedSmestajIDs:   string(smJSON),
					SelectedPrevozIDs:    string(prJSON),
					SelectedRentItemsRaw: string(reJSON),
				}
				_ = db.Create(&izbor).Error
			} else {
				izbor.SelectedPrevozIDs = string(prJSON)
				_ = db.Save(&izbor).Error
			}
		}
	}
	c.JSON(200, gin.H{"message": "Prevoz dodat", "prevoz": row})
}

func ObrisiPrevozZaAkciju(c *gin.Context) {
	akcijaID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	prevozID64, err := strconv.ParseUint(strings.TrimSpace(c.Param("prevozId")), 10, 32)
	if err != nil || prevozID64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prevoza"})
		return
	}
	prevozID := uint(prevozID64)

	db := c.MustGet("db").(*gorm.DB)

	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba može obrisati prevoz"})
		return
	}
	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je završena"})
		return
	}

	var prev models.AkcijaPrevoz
	if err := db.Where("id = ? AND akcija_id = ?", prevozID, akcija.ID).First(&prev).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prevoz nije pronađen"})
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		var prijave []models.Prijava
		if err := tx.Where("akcija_id = ?", akcija.ID).Find(&prijave).Error; err != nil {
			return err
		}
		for _, p := range prijave {
			var izbor models.PrijavaIzbori
			if err := tx.Where("prijava_id = ?", p.ID).First(&izbor).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					continue
				}
				return err
			}
			var sel []uint
			_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &sel)
			newSel := make([]uint, 0, len(sel))
			removed := false
			for _, id := range sel {
				if id == prevozID {
					removed = true
					continue
				}
				newSel = append(newSel, id)
			}
			if !removed {
				continue
			}
			prJSON, _ := json.Marshal(newSel)
			izbor.SelectedPrevozIDs = string(prJSON)
			if err := tx.Save(&izbor).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&models.AkcijaPrevoz{}, prev.ID).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju prevoza"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Prevoz obrisan"})
}

func GetPrevozPrijave(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}

	canSee := false
	if akcija.PrikaziListuPrijavljenih && akcija.Javna {
		canSee = true
	} else if akcija.KlubID != nil {
		if viewerClubID, ok := helpers.GetEffectiveClubID(c, db); ok && viewerClubID == *akcija.KlubID {
			canSee = true
		}
	}
	if !canSee {
		c.JSON(http.StatusForbidden, gin.H{"error": "Spisak prevoza nije dostupan"})
		return
	}

	var prijave []models.Prijava
	_ = db.Preload("Korisnik").Where("akcija_id = ? AND status IN ?", akcija.ID, []string{"prijavljen", "popeo se", "nije uspeo"}).Find(&prijave).Error
	prevozMap := map[uint][]gin.H{}
	for _, p := range prijave {
		var izbor models.PrijavaIzbori
		if err := db.Where("prijava_id = ?", p.ID).First(&izbor).Error; err != nil {
			continue
		}
		var selPrevoz []uint
		_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
		for _, pid := range selPrevoz {
			prevozMap[pid] = append(prevozMap[pid], gin.H{
				"prijavaId": p.ID,
				"korisnik":  p.Korisnik.Username,
				"fullName":  p.Korisnik.FullName,
				"avatarUrl": p.Korisnik.AvatarURL,
			})
		}
	}
	c.JSON(200, gin.H{"prevozPrijave": prevozMap})
}

func DodajClanaPopeoSe(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može dodati člana na završenu akciju"})
		return
	}

	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var req struct {
		KorisnikID uint `json:"korisnikId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.KorisnikID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći korisnikId"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da dodaje članove na ovu akciju"})
		return
	}
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Član se ovde može dodati tek kada je akcija završena"})
		return
	}

	var korisnik models.Korisnik
	if err := db.First(&korisnik, req.KorisnikID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if korisnik.Role == "deleted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Korisnik je deaktiviran"})
		return
	}
	if akcija.KlubID == nil || korisnik.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Možete dodati samo člana kluba koji je domaćin akcije"})
		return
	}

	var prijava models.Prijava
	err = db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijave"})
		return
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		prijava = models.Prijava{
			AkcijaID:   akcija.ID,
			KorisnikID: korisnik.ID,
			Status:     "popeo se",
		}
		if err := db.Create(&prijava).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju člana na akciju"})
			return
		}
	} else {
		if prijava.Status == "popeo se" {
			c.JSON(http.StatusConflict, gin.H{"error": "Član je već označen kao uspešno popeo se"})
			return
		}
		prijava.Status = "popeo se"
		if err := db.Save(&prijava).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju prijave"})
			return
		}
	}

	korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
	korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
	korisnik.BrojPopeoSe += 1
	if err := db.Save(&korisnik).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
		return
	}
	notifySummitReward(db, korisnik.ID, akcija)

	c.JSON(http.StatusOK, gin.H{
		"message": "Član je dodat na završenu akciju kao uspešno popeo se",
		"prijava": prijava,
	})
}

func UpdatePrijavaPlatioStatus(c *gin.Context) {
	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var prijava models.Prijava
	if err := db.First(&prijava, prijavaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prijava nije pronađena"})
		return
	}

	var akcija models.Akcija
	if err := db.First(&akcija, prijava.AkcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemaš pravo da menjaš status uplate"})
		return
	}
	var req struct {
		Platio bool `json:"platio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}

	// Nakon završetka akcije dozvoljavamo samo naknadnu potvrdu uplate (false -> true).
	// Povrat sa true -> false bi razvezao finansijsku evidenciju koja je već importovana.
	if akcija.IsCompleted && prijava.Platio && !req.Platio {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Za završenu akciju nije dozvoljeno vraćanje uplate na neplaćeno"})
		return
	}

	alreadyPaid := prijava.Platio
	if alreadyPaid == req.Platio {
		c.JSON(http.StatusOK, gin.H{
			"message": "Status uplate je ažuriran",
			"platio":  prijava.Platio,
		})
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&prijava, prijava.ID).Error; err != nil {
			return err
		}
		if prijava.Platio == req.Platio {
			return nil
		}
		prijava.Platio = req.Platio
		if err := tx.Save(&prijava).Error; err != nil {
			return err
		}

		// Ako je akcija završena i sad je član označen kao plaćen,
		// odmah upisujemo pojedinačnu uplatu u finansije.
		if akcija.IsCompleted && !alreadyPaid && req.Platio {
			username, exists := c.Get("username")
			if !exists {
				return errors.New("Niste ulogovani")
			}
			var actor models.Korisnik
			if err := helpers.DBWhereUsername(tx, helpers.UsernameFromContext(username)).First(&actor).Error; err != nil {
				return err
			}

			var prijavaWithUser models.Prijava
			if err := tx.Preload("Korisnik").First(&prijavaWithUser, prijava.ID).Error; err != nil {
				return err
			}

			saldo := computeBaseCenaForUser(akcija, prijavaWithUser.Korisnik)
			var izbor models.PrijavaIzbori
			selSmestaj := []uint{}
			selPrevoz := []uint{}
			selRent := []prijavaRentItem{}
			if err := tx.Where("prijava_id = ?", prijava.ID).First(&izbor).Error; err == nil {
				_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
				_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
				_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
			}

			if len(selSmestaj) > 0 {
				var smestajRows []models.AkcijaSmestaj
				if err := tx.Where("akcija_id = ? AND id IN ?", akcija.ID, selSmestaj).Find(&smestajRows).Error; err == nil {
					for _, row := range smestajRows {
						saldo += row.CenaPoOsobiUkupno
					}
				}
			}
			if len(selPrevoz) > 0 {
				var prevozRows []models.AkcijaPrevoz
				if err := tx.Where("akcija_id = ? AND id IN ?", akcija.ID, selPrevoz).Find(&prevozRows).Error; err == nil {
					for _, row := range prevozRows {
						saldo += row.CenaPoOsobi
					}
				}
			}
			if len(selRent) > 0 {
				var rentRows []models.AkcijaOpremaRent
				if err := tx.Where("akcija_id = ?", akcija.ID).Find(&rentRows).Error; err == nil {
					rentByID := map[uint]float64{}
					for _, r := range rentRows {
						rentByID[r.ID] = r.CenaPoSetu
					}
					for _, item := range selRent {
						if item.Kolicina > 0 {
							saldo += rentByID[item.RentID] * float64(item.Kolicina)
						}
					}
				}
			}

			if saldo > 0 {
				displayName := strings.TrimSpace(prijavaWithUser.Korisnik.FullName)
				if displayName == "" {
					displayName = strings.TrimSpace(prijavaWithUser.Korisnik.Username)
				}
				if displayName == "" {
					displayName = fmt.Sprintf("član #%d", prijavaWithUser.KorisnikID)
				}
				opis := fmt.Sprintf("Uplata za akciju (%s) - %s", strings.TrimSpace(akcija.Naziv), displayName)
				if err := tx.Create(&models.Transakcija{
					Tip:        "uplata",
					Iznos:      saldo,
					Opis:       opis,
					Datum:      time.Now(),
					KorisnikID: actor.ID,
				}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju uplate"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Status uplate je ažuriran",
		"platio":  req.Platio,
	})
}

func ZavrsiAkciju(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može završiti akciju"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	var actor models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&actor).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je završi"})
		return
	}

	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je već završena"})
		return
	}

	importedCount := 0
	importedAmount := 0.0
	err = db.Transaction(func(tx *gorm.DB) error {
		akcija.IsCompleted = true
		if err := tx.Save(&akcija).Error; err != nil {
			return err
		}

		var prijave []models.Prijava
		if err := tx.Preload("Korisnik").
			Where("akcija_id = ? AND platio = ? AND status IN ?", akcija.ID, true, []string{"prijavljen", "popeo se", "nije uspeo"}).
			Find(&prijave).Error; err != nil {
			return err
		}

		if len(prijave) == 0 {
			return nil
		}

		var smestajRows []models.AkcijaSmestaj
		_ = tx.Where("akcija_id = ?", akcija.ID).Find(&smestajRows).Error
		smestajByID := map[uint]float64{}
		for _, s := range smestajRows {
			smestajByID[s.ID] = s.CenaPoOsobiUkupno
		}

		var prevozRows []models.AkcijaPrevoz
		_ = tx.Where("akcija_id = ?", akcija.ID).Find(&prevozRows).Error
		prevozByID := map[uint]float64{}
		for _, p := range prevozRows {
			prevozByID[p.ID] = p.CenaPoOsobi
		}

		var rentRows []models.AkcijaOpremaRent
		_ = tx.Where("akcija_id = ?", akcija.ID).Find(&rentRows).Error
		rentByID := map[uint]float64{}
		for _, r := range rentRows {
			rentByID[r.ID] = r.CenaPoSetu
		}

		for _, p := range prijave {
			saldo := computeBaseCenaForUser(akcija, p.Korisnik)
			var izbor models.PrijavaIzbori
			selSmestaj := []uint{}
			selPrevoz := []uint{}
			selRent := []prijavaRentItem{}
			if err := tx.Where("prijava_id = ?", p.ID).First(&izbor).Error; err == nil {
				_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
				_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
				_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
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
			if saldo <= 0 {
				continue
			}
			importedAmount += saldo
			importedCount++
		}

		if importedAmount <= 0 {
			return nil
		}
		return tx.Create(&models.Transakcija{
			Tip:        "uplata",
			Iznos:      importedAmount,
			Opis:       fmt.Sprintf("Uplate sa akcije %s", strings.TrimSpace(akcija.Naziv)),
			Datum:      time.Now(),
			KorisnikID: actor.ID,
		}).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri završavanju akcije"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Akcija uspešno završena",
		"akcija":         akcija,
		"importedUplate": importedCount,
		"importedIznos":  importedAmount,
	})
}

func DeleteAkcija(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može obrisati akciju"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je obriše"})
		return
	}

	var prijavaIDs []uint
	_ = db.Model(&models.Prijava{}).Where("akcija_id = ?", id).Pluck("id", &prijavaIDs).Error
	if len(prijavaIDs) > 0 {
		_ = db.Where("prijava_id IN ?", prijavaIDs).Delete(&models.PrijavaIzbori{}).Error
	}
	_ = db.Where("akcija_id = ?", id).Delete(&models.ActionParticipationRequest{}).Error
	if err := db.Where("akcija_id = ?", id).Delete(&models.Prijava{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju prijava"})
		return
	}
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaSmestaj{}).Error
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaOpremaRent{}).Error
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaOprema{}).Error
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaPrevoz{}).Error
	if err := db.Delete(&akcija).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju akcije"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Akcija uspešno obrisana"})
}

func OtkaziPrijavuNaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
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

	var prijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", id, korisnik.ID).First(&prijava).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Niste bili prijavljeni na ovu akciju"})
		return
	}
	if prijava.Status != "prijavljen" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Ne možete otkazati prijavu nakon što vam je admin potvrdio uspeh ili neuspeh"})
		return
	}
	if err := db.Delete(&prijava).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju"})
		return
	}
	_ = db.Where("prijava_id = ?", prijava.ID).Delete(&models.PrijavaIzbori{}).Error
	c.JSON(http.StatusOK, gin.H{"message": "Uspešno ste otkazali prijavu"})
}

func GetMojePopeoSe(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Korisnik nije pronađen", "details": err.Error()})
		return
	}

	var prijave []models.Prijava
	err := db.Where("korisnik_id = ? AND status = ?", korisnik.ID, "popeo se").Preload("Akcija").Find(&prijave).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijava", "details": err.Error()})
		return
	}

	var uspesneAkcije []models.Akcija
	var ukupnoKm float64
	var ukupnoMetaraUspona int
	var brojPopeoSe int
	for _, p := range prijave {
		if p.Akcija.ID != 0 {
			uspesneAkcije = append(uspesneAkcije, p.Akcija)
			ukupnoKm += p.Akcija.UkupnoKmAkcija
			ukupnoMetaraUspona += p.Akcija.UkupnoMetaraUsponaAkcija
			brojPopeoSe++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"uspesneAkcije": uspesneAkcije,
		"statistika": map[string]interface{}{
			"ukupnoKm":           ukupnoKm,
			"ukupnoMetaraUspona": ukupnoMetaraUspona,
			"brojPopeoSe":        brojPopeoSe,
		},
	})
}

func UpdatePrijavaStatus(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič može menjati status"})
		return
	}

	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći status"})
		return
	}

	log.Printf("Primljen status (raw): '%q'", req.Status)
	log.Printf("Dužina stringa: %d", len(req.Status))

	validStatuses := map[string]bool{"prijavljen": true, "popeo se": true, "nije uspeo": true, "otkazano": true}
	if !validStatuses[req.Status] {
		c.JSON(400, gin.H{"error": "Nevažeći status"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var prijava models.Prijava
	if err := db.Preload("Akcija").First(&prijava, prijavaID).Error; err != nil {
		c.JSON(404, gin.H{"error": "Prijava nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, prijava.Akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da menja status prijava"})
		return
	}

	wasPopeoSe := prijava.Status == "popeo se"
	willBePopeoSe := req.Status == "popeo se"
	if wasPopeoSe != willBePopeoSe {
		var korisnik models.Korisnik
		if err := db.First(&korisnik, prijava.KorisnikID).Error; err != nil {
			c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
		if willBePopeoSe {
			korisnik.UkupnoKmKorisnik += prijava.Akcija.UkupnoKmAkcija
			korisnik.UkupnoMetaraUsponaKorisnik += prijava.Akcija.UkupnoMetaraUsponaAkcija
			korisnik.BrojPopeoSe += 1
		} else {
			korisnik.UkupnoKmKorisnik -= prijava.Akcija.UkupnoKmAkcija
			korisnik.UkupnoMetaraUsponaKorisnik -= prijava.Akcija.UkupnoMetaraUsponaAkcija
			korisnik.BrojPopeoSe -= 1
			if korisnik.UkupnoKmKorisnik < 0 {
				korisnik.UkupnoKmKorisnik = 0
			}
			if korisnik.UkupnoMetaraUsponaKorisnik < 0 {
				korisnik.UkupnoMetaraUsponaKorisnik = 0
			}
			if korisnik.BrojPopeoSe < 0 {
				korisnik.BrojPopeoSe = 0
			}
		}
		if err := db.Save(&korisnik).Error; err != nil {
			c.JSON(500, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
			return
		}
		if willBePopeoSe {
			notifySummitReward(db, korisnik.ID, prijava.Akcija)
		}
	}

	prijava.Status = req.Status
	if err := db.Save(&prijava).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri ažuriranju statusa"})
		return
	}
	c.JSON(200, gin.H{"message": "Status ažuriran", "prijava": prijava})
}

func DeletePrijava(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može da ukloni člana sa akcije"})
		return
	}

	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var prijava models.Prijava
	if err := db.Preload("Akcija").First(&prijava, prijavaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prijava nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, prijava.Akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da ukloni člana sa akcije"})
		return
	}

	if prijava.Status == "popeo se" {
		var korisnik models.Korisnik
		if err := db.First(&korisnik, prijava.KorisnikID).Error; err == nil {
			korisnik.UkupnoKmKorisnik -= prijava.Akcija.UkupnoKmAkcija
			korisnik.UkupnoMetaraUsponaKorisnik -= prijava.Akcija.UkupnoMetaraUsponaAkcija
			korisnik.BrojPopeoSe -= 1
			if korisnik.UkupnoKmKorisnik < 0 {
				korisnik.UkupnoKmKorisnik = 0
			}
			if korisnik.UkupnoMetaraUsponaKorisnik < 0 {
				korisnik.UkupnoMetaraUsponaKorisnik = 0
			}
			if korisnik.BrojPopeoSe < 0 {
				korisnik.BrojPopeoSe = 0
			}
			db.Save(&korisnik)
		}
	}

	if err := db.Delete(&prijava).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri uklanjanju člana sa akcije"})
		return
	}
	_ = db.Where("prijava_id = ?", prijava.ID).Delete(&models.PrijavaIzbori{}).Error
	c.JSON(http.StatusOK, gin.H{"message": "Član je uklonjen sa akcije"})
}

func GetMojePrijave(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var prijavljene []uint
	db.Model(&models.Prijava{}).Where("korisnik_id = ?", korisnik.ID).Pluck("akcija_id", &prijavljene)
	var otkazive []uint
	db.Model(&models.Prijava{}).Where("korisnik_id = ? AND status = ?", korisnik.ID, "prijavljen").Pluck("akcija_id", &otkazive)

	c.JSON(http.StatusOK, gin.H{
		"prijavljeneAkcije": prijavljene,
		"otkaziveAkcije":    otkazive,
	})
}
