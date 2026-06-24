package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var allowedTezine = map[string]bool{"lako": true, "srednje": true, "tesko": true, "alpinizam": true}

func isValidTezina(tezina string) bool {
	return allowedTezine[strings.TrimSpace(strings.ToLower(tezina))]
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

func loadPrevozOccupancyByAction(db *gorm.DB, akcijaID uint, excludePrijavaID *uint) (map[uint]int, error) {
	type prevozRawRow struct {
		SelectedPrevozIDs string `gorm:"column:selected_prevoz_ids"`
	}
	q := db.Table("prijava_izbori").
		Select("prijava_izbori.selected_prevoz_ids").
		Joins("JOIN prijave ON prijave.id = prijava_izbori.prijava_id").
		Where("prijave.akcija_id = ? AND prijave.status = ?", akcijaID, "prijavljen")
	if excludePrijavaID != nil {
		q = q.Where("prijava_izbori.prijava_id <> ?", *excludePrijavaID)
	}
	var rows []prevozRawRow
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	occupied := map[uint]int{}
	for _, row := range rows {
		if strings.TrimSpace(row.SelectedPrevozIDs) == "" || row.SelectedPrevozIDs == "null" {
			continue
		}
		var ids []uint
		if err := json.Unmarshal([]byte(row.SelectedPrevozIDs), &ids); err != nil {
			continue
		}
		for _, pid := range ids {
			if pid > 0 {
				occupied[pid]++
			}
		}
	}
	return occupied, nil
}

func validatePrevozCapacity(db *gorm.DB, akcijaID uint, prevozIDs []uint, excludePrijavaID *uint) error {
	if len(prevozIDs) == 0 {
		return nil
	}
	occupied, err := loadPrevozOccupancyByAction(db, akcijaID, excludePrijavaID)
	if err != nil {
		return err
	}
	for _, pid := range prevozIDs {
		if pid == 0 {
			continue
		}
		var row models.AkcijaPrevoz
		if err := db.Where("akcija_id = ? AND id = ?", akcijaID, pid).First(&row).Error; err != nil {
			return errors.New("Nevažeći prevoz")
		}
		if row.Kapacitet <= 0 {
			continue
		}
		if occupied[pid] >= row.Kapacitet {
			return errors.New("Prevoz '" + row.NazivGrupe + "' je pun")
		}
	}
	return nil
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

func trajanjeSatiFromFerrataMaxMinutes(maxMin int) float64 {
	if maxMin <= 0 {
		return 1
	}
	h := float64(maxMin) / 60.0
	if h < 0.05 {
		h = 0.05
	}
	return math.Round(h*100) / 100
}

// applyViaFerrataAkcijaDefaults: trajanje iz kataloga (max min → sati), jednodnevno, bez zimskog / visine vrha / mesta polaska.
func applyViaFerrataAkcijaDefaults(akcija *models.Akcija, ft *models.Ferrata) {
	if akcija == nil || ft == nil {
		return
	}
	akcija.TrajanjeSati = trajanjeSatiFromFerrataMaxMinutes(ft.TrajanjeMax)
	akcija.MestoPolaska = ""
	akcija.BrojDana = 1
	akcija.ZimskiUspon = false
	akcija.VisinaVrhM = 0
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
	return helpers.ComputeBaseCenaForUser(akcija, korisnik)
}

// akcijaSkipsClubFinances: privatna tura vodiča; prijave i uplate se prate kao i inače, ali se ne upisuju u finansije kluba.
func akcijaSkipsClubFinances(akcija models.Akcija) bool {
	return helpers.AkcijaSkipsClubFinances(akcija)
}

func viewerIsRegisteredOnAkcija(db *gorm.DB, akcijaID uint, viewerID uint) bool {
	if viewerID == 0 {
		return false
	}
	var n int64
	db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ? AND status <> ?", akcijaID, viewerID, "otkazano").
		Count(&n)
	return n > 0
}

// viewerCanAccessPrivateAkcija: vodič akcije ili prijavljeni učesnik vide pun detalj privatne ture.
func viewerCanAccessPrivateAkcija(db *gorm.DB, akcija *models.Akcija, viewer *models.Korisnik) bool {
	if viewer == nil || akcija == nil {
		return false
	}
	if akcija.VodicID > 0 && akcija.VodicID == viewer.ID {
		return true
	}
	return viewerIsRegisteredOnAkcija(db, akcija.ID, viewer.ID)
}

// sqlClubOrganizedOnly: klupske akcije (isključuje privatne ture vodiča iz kalendara/istorije kluba).
const sqlClubOrganizedOnly = "(organizator_tip IS NULL OR TRIM(organizator_tip) = '' OR LOWER(TRIM(organizator_tip)) <> 'vodic')"

func resolveFinanceRecorderID(tx *gorm.DB, actionClubID *uint, fallbackUserID uint) uint {
	if actionClubID == nil || *actionClubID == 0 {
		return fallbackUserID
	}

	var fallback models.Korisnik
	if err := tx.Select("id", "klub_id").First(&fallback, fallbackUserID).Error; err == nil {
		if fallback.KlubID != nil && *fallback.KlubID == *actionClubID {
			return fallback.ID
		}
	}

	var clubUser models.Korisnik
	if err := tx.Select("id").
		Where("klub_id = ? AND role IN ?", *actionClubID, []string{"admin", "blagajnik", "vodic"}).
		Order("id ASC").
		First(&clubUser).Error; err == nil {
		return clubUser.ID
	}

	if err := tx.Select("id").Where("klub_id = ?", *actionClubID).Order("id ASC").First(&clubUser).Error; err == nil {
		return clubUser.ID
	}

	return fallbackUserID
}
