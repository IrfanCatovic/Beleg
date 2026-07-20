package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ErrNestedOptionInUse vraća se kada admin pokuša ukloniti opciju koju koriste aktivne prijave.
var ErrNestedOptionInUse = errors.New(
	"Opciju nije moguće ukloniti jer je koriste postojeće prijave. Prvo izmijeni ili ukloni povezane izbore učesnika.",
)

// ActionNestedSyncInput omogućava testiranje i jasno razlikovanje omitted vs empty vs data.
// Nil pointer = polje nije poslato; non-nil prazan ili "[]" = eksplicitno prazna lista.
type ActionNestedSyncInput struct {
	Smestaj *string
	Oprema  *string
	Prevoz  *string
}

func actionNestedSyncInputFromContext(c *gin.Context) ActionNestedSyncInput {
	var in ActionNestedSyncInput
	if multipartFormHasKey(c, "smestajJson") {
		v := c.PostForm("smestajJson")
		in.Smestaj = &v
	}
	if multipartFormHasKey(c, "opremaJson") {
		v := c.PostForm("opremaJson")
		in.Oprema = &v
	}
	if multipartFormHasKey(c, "prevozJson") {
		v := c.PostForm("prevozJson")
		in.Prevoz = &v
	}
	return in
}

func multipartFormHasKey(c *gin.Context, key string) bool {
	if c == nil || c.Request == nil {
		return false
	}
	if c.Request.MultipartForm != nil {
		if _, ok := c.Request.MultipartForm.Value[key]; ok {
			return true
		}
	}
	if c.Request.PostForm != nil {
		if _, ok := c.Request.PostForm[key]; ok {
			return true
		}
	}
	return false
}

type nestedFieldMode int

const (
	nestedFieldOmitted nestedFieldMode = iota
	nestedFieldEmpty
	nestedFieldWithData
)

func classifyNestedJSONField(rawPtr *string) (nestedFieldMode, string) {
	if rawPtr == nil {
		return nestedFieldOmitted, ""
	}
	raw := strings.TrimSpace(*rawPtr)
	if raw == "" || raw == "[]" || raw == "null" {
		return nestedFieldEmpty, raw
	}
	return nestedFieldWithData, raw
}

type akcijaNestedReferences struct {
	smestaj map[uint]struct{}
	prevoz  map[uint]struct{}
	rent    map[uint]struct{}
}

func loadAkcijaNestedReferences(db *gorm.DB, akcijaID uint) (akcijaNestedReferences, error) {
	refs := akcijaNestedReferences{
		smestaj: map[uint]struct{}{},
		prevoz:  map[uint]struct{}{},
		rent:    map[uint]struct{}{},
	}
	type izborRow struct {
		SelectedSmestajIDs   string `gorm:"column:selected_smestaj_ids"`
		SelectedPrevozIDs    string `gorm:"column:selected_prevoz_ids"`
		SelectedRentItemsRaw string `gorm:"column:selected_rent_items_raw"`
	}
	var rows []izborRow
	if err := db.Table("prijava_izbori").
		Select("prijava_izbori.selected_smestaj_ids, prijava_izbori.selected_prevoz_ids, prijava_izbori.selected_rent_items_raw").
		Joins("JOIN prijave ON prijave.id = prijava_izbori.prijava_id").
		Where("prijave.akcija_id = ? AND prijave.status = ?", akcijaID, "prijavljen").
		Find(&rows).Error; err != nil {
		return refs, err
	}
	for _, row := range rows {
		for _, id := range parseUintJSONArray(row.SelectedSmestajIDs) {
			if id > 0 {
				refs.smestaj[id] = struct{}{}
			}
		}
		for _, id := range parseUintJSONArray(row.SelectedPrevozIDs) {
			if id > 0 {
				refs.prevoz[id] = struct{}{}
			}
		}
		for _, item := range parseRentItemsJSONArray(row.SelectedRentItemsRaw) {
			if item.RentID > 0 {
				refs.rent[item.RentID] = struct{}{}
			}
		}
	}
	return refs, nil
}

func parseUintJSONArray(raw string) []uint {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil
	}
	var ids []uint
	if err := json.Unmarshal([]byte(raw), &ids); err != nil {
		return nil
	}
	return ids
}

func parseRentItemsJSONArray(raw string) []prijavaRentItem {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil
	}
	var items []prijavaRentItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return nil
	}
	return items
}

func ensureIDsNotReferenced(refs akcijaNestedReferences, smestajIDs, prevozIDs, rentIDs []uint) error {
	for _, id := range smestajIDs {
		if _, ok := refs.smestaj[id]; ok {
			return ErrNestedOptionInUse
		}
	}
	for _, id := range prevozIDs {
		if _, ok := refs.prevoz[id]; ok {
			return ErrNestedOptionInUse
		}
	}
	for _, id := range rentIDs {
		if _, ok := refs.rent[id]; ok {
			return ErrNestedOptionInUse
		}
	}
	return nil
}

func normalizeKey(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func filterSmestajItems(items []createSmestajItem) ([]createSmestajItem, error) {
	out := make([]createSmestajItem, 0, len(items))
	for _, s := range items {
		if strings.TrimSpace(s.Naziv) == "" {
			continue
		}
		if s.CenaPoOsobiUkupno < 0 {
			return nil, errors.New("cena smeštaja ne može biti negativna")
		}
		out = append(out, s)
	}
	return out, nil
}

func filterPrevozItems(items []createPrevozItem) ([]createPrevozItem, error) {
	out := make([]createPrevozItem, 0, len(items))
	for _, p := range items {
		if strings.TrimSpace(p.TipPrevoza) == "" || strings.TrimSpace(p.NazivGrupe) == "" {
			continue
		}
		if p.Kapacitet < 0 || p.CenaPoOsobi < 0 {
			return nil, errors.New("kapacitet i cena prevoza moraju biti >= 0")
		}
		out = append(out, p)
	}
	return out, nil
}

func filterOpremaItems(items []createOpremaItem) ([]createOpremaItem, error) {
	out := make([]createOpremaItem, 0, len(items))
	for _, o := range items {
		if strings.TrimSpace(o.Naziv) == "" {
			continue
		}
		if o.DostupnaKolicina < 0 || o.CenaPoSetu < 0 {
			return nil, errors.New("količina i cena rent opreme moraju biti >= 0")
		}
		out = append(out, o)
	}
	return out, nil
}

func smestajMatchKey(item createSmestajItem) string {
	return normalizeKey(item.Naziv)
}

func prevozMatchKey(item createPrevozItem) string {
	return normalizeKey(item.TipPrevoza) + "|" + normalizeKey(item.NazivGrupe)
}

func rentMatchKey(name string) string {
	return normalizeKey(name)
}

// syncActionNestedDataOnUpdate ažurira nested podatke samo za poslata polja, u jednoj transakciji.
func syncActionNestedDataOnUpdate(db *gorm.DB, akcijaID uint, input ActionNestedSyncInput) error {
	return db.Transaction(func(tx *gorm.DB) error {
		refs, err := loadAkcijaNestedReferences(tx, akcijaID)
		if err != nil {
			return err
		}
		if err := syncSmestajOnUpdate(tx, akcijaID, input.Smestaj, refs); err != nil {
			return err
		}
		if err := syncOpremaRentOnUpdate(tx, akcijaID, input.Oprema, refs); err != nil {
			return err
		}
		if err := syncPrevozOnUpdate(tx, akcijaID, input.Prevoz, refs); err != nil {
			return err
		}
		return nil
	})
}

func syncActionNestedDataOnUpdateFromContext(db *gorm.DB, akcijaID uint, c *gin.Context) error {
	return syncActionNestedDataOnUpdate(db, akcijaID, actionNestedSyncInputFromContext(c))
}

func syncSmestajOnUpdate(tx *gorm.DB, akcijaID uint, rawPtr *string, refs akcijaNestedReferences) error {
	mode, raw := classifyNestedJSONField(rawPtr)
	if mode == nestedFieldOmitted {
		return nil
	}

	var existing []models.AkcijaSmestaj
	if err := tx.Where("akcija_id = ?", akcijaID).Find(&existing).Error; err != nil {
		return err
	}

	if mode == nestedFieldEmpty {
		removeIDs := make([]uint, 0, len(existing))
		for _, row := range existing {
			removeIDs = append(removeIDs, row.ID)
		}
		if err := ensureIDsNotReferenced(refs, removeIDs, nil, nil); err != nil {
			return err
		}
		return tx.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaSmestaj{}).Error
	}

	var items []createSmestajItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return fmt.Errorf("nevažeći smestajJson: %w", err)
	}
	var err error
	items, err = filterSmestajItems(items)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return syncSmestajOnUpdate(tx, akcijaID, strPtr("[]"), refs)
	}

	existingByKey := make(map[string]models.AkcijaSmestaj, len(existing))
	for _, row := range existing {
		existingByKey[normalizeKey(row.Naziv)] = row
	}
	kept := map[uint]struct{}{}

	for _, item := range items {
		key := smestajMatchKey(item)
		if row, ok := existingByKey[key]; ok {
			kept[row.ID] = struct{}{}
			if err := tx.Model(&models.AkcijaSmestaj{}).Where("id = ? AND akcija_id = ?", row.ID, akcijaID).Updates(map[string]interface{}{
				"naziv":                strings.TrimSpace(item.Naziv),
				"cena_po_osobi_ukupno": item.CenaPoOsobiUkupno,
				"opis":                 strings.TrimSpace(item.Opis),
			}).Error; err != nil {
				return err
			}
			continue
		}
		row := models.AkcijaSmestaj{
			AkcijaID:          akcijaID,
			Naziv:             strings.TrimSpace(item.Naziv),
			CenaPoOsobiUkupno: item.CenaPoOsobiUkupno,
			Opis:              strings.TrimSpace(item.Opis),
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		kept[row.ID] = struct{}{}
	}

	for _, row := range existing {
		if _, ok := kept[row.ID]; ok {
			continue
		}
		if err := ensureIDsNotReferenced(refs, []uint{row.ID}, nil, nil); err != nil {
			return err
		}
		if err := tx.Delete(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func syncPrevozOnUpdate(tx *gorm.DB, akcijaID uint, rawPtr *string, refs akcijaNestedReferences) error {
	mode, raw := classifyNestedJSONField(rawPtr)
	if mode == nestedFieldOmitted {
		return nil
	}

	var existing []models.AkcijaPrevoz
	if err := tx.Where("akcija_id = ?", akcijaID).Find(&existing).Error; err != nil {
		return err
	}

	if mode == nestedFieldEmpty {
		removeIDs := make([]uint, 0, len(existing))
		for _, row := range existing {
			removeIDs = append(removeIDs, row.ID)
		}
		if err := ensureIDsNotReferenced(refs, nil, removeIDs, nil); err != nil {
			return err
		}
		return tx.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaPrevoz{}).Error
	}

	var items []createPrevozItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return fmt.Errorf("nevažeći prevozJson: %w", err)
	}
	items, err := filterPrevozItems(items)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return syncPrevozOnUpdate(tx, akcijaID, strPtr("[]"), refs)
	}

	existingByKey := make(map[string]models.AkcijaPrevoz, len(existing))
	for _, row := range existing {
		existingByKey[normalizeKey(row.TipPrevoza)+"|"+normalizeKey(row.NazivGrupe)] = row
	}
	kept := map[uint]struct{}{}

	for _, item := range items {
		key := prevozMatchKey(item)
		if row, ok := existingByKey[key]; ok {
			kept[row.ID] = struct{}{}
			if err := tx.Model(&models.AkcijaPrevoz{}).Where("id = ? AND akcija_id = ?", row.ID, akcijaID).Updates(map[string]interface{}{
				"tip_prevoza":   strings.TrimSpace(item.TipPrevoza),
				"naziv_grupe":   strings.TrimSpace(item.NazivGrupe),
				"kapacitet":     item.Kapacitet,
				"cena_po_osobi": item.CenaPoOsobi,
			}).Error; err != nil {
				return err
			}
			continue
		}
		row := models.AkcijaPrevoz{
			AkcijaID:    akcijaID,
			TipPrevoza:  strings.TrimSpace(item.TipPrevoza),
			NazivGrupe:  strings.TrimSpace(item.NazivGrupe),
			Kapacitet:   item.Kapacitet,
			CenaPoOsobi: item.CenaPoOsobi,
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		kept[row.ID] = struct{}{}
	}

	for _, row := range existing {
		if _, ok := kept[row.ID]; ok {
			continue
		}
		if err := ensureIDsNotReferenced(refs, nil, []uint{row.ID}, nil); err != nil {
			return err
		}
		if err := tx.Delete(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func syncOpremaRentOnUpdate(tx *gorm.DB, akcijaID uint, rawPtr *string, refs akcijaNestedReferences) error {
	mode, raw := classifyNestedJSONField(rawPtr)
	if mode == nestedFieldOmitted {
		return nil
	}

	var existingRent []models.AkcijaOpremaRent
	if err := tx.Where("akcija_id = ?", akcijaID).Find(&existingRent).Error; err != nil {
		return err
	}

	if mode == nestedFieldEmpty {
		removeIDs := make([]uint, 0, len(existingRent))
		for _, row := range existingRent {
			removeIDs = append(removeIDs, row.ID)
		}
		if err := ensureIDsNotReferenced(refs, nil, nil, removeIDs); err != nil {
			return err
		}
		if err := tx.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaOpremaRent{}).Error; err != nil {
			return err
		}
		return tx.Where("akcija_id = ?", akcijaID).Delete(&models.AkcijaOprema{}).Error
	}

	var items []createOpremaItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return fmt.Errorf("nevažeći opremaJson: %w", err)
	}
	items, err := filterOpremaItems(items)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return syncOpremaRentOnUpdate(tx, akcijaID, strPtr("[]"), refs)
	}

	existingByKey := make(map[string]models.AkcijaOpremaRent, len(existingRent))
	for _, row := range existingRent {
		existingByKey[rentMatchKey(row.NazivOpreme)] = row
	}
	keptRent := map[uint]struct{}{}

	for _, item := range items {
		name := strings.TrimSpace(item.Naziv)
		key := rentMatchKey(name)
		if row, ok := existingByKey[key]; ok {
			keptRent[row.ID] = struct{}{}
			if err := tx.Model(&models.AkcijaOpremaRent{}).Where("id = ? AND akcija_id = ?", row.ID, akcijaID).Updates(map[string]interface{}{
				"naziv_opreme":      name,
				"dostupna_kolicina": item.DostupnaKolicina,
				"cena_po_setu":      item.CenaPoSetu,
			}).Error; err != nil {
				return err
			}
			if row.AkcijaOpremaID != nil {
				if err := tx.Model(&models.AkcijaOprema{}).Where("id = ? AND akcija_id = ?", *row.AkcijaOpremaID, akcijaID).Update("naziv", name).Error; err != nil {
					return err
				}
			}
			continue
		}

		opremaRow := models.AkcijaOprema{
			AkcijaID: akcijaID,
			Naziv:    name,
			Obavezna: true,
		}
		if err := tx.Create(&opremaRow).Error; err != nil {
			return err
		}
		rentRow := models.AkcijaOpremaRent{
			AkcijaID:         akcijaID,
			AkcijaOpremaID:   &opremaRow.ID,
			NazivOpreme:      name,
			DostupnaKolicina: item.DostupnaKolicina,
			CenaPoSetu:       item.CenaPoSetu,
		}
		if err := tx.Create(&rentRow).Error; err != nil {
			return err
		}
		keptRent[rentRow.ID] = struct{}{}
	}

	for _, row := range existingRent {
		if _, ok := keptRent[row.ID]; ok {
			continue
		}
		if err := ensureIDsNotReferenced(refs, nil, nil, []uint{row.ID}); err != nil {
			return err
		}
		if row.AkcijaOpremaID != nil {
			if err := tx.Where("id = ? AND akcija_id = ?", *row.AkcijaOpremaID, akcijaID).Delete(&models.AkcijaOprema{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&row).Error; err != nil {
			return err
		}
	}

	var orphanOprema []models.AkcijaOprema
	if err := tx.Where("akcija_id = ?", akcijaID).Find(&orphanOprema).Error; err != nil {
		return err
	}
	for _, oprema := range orphanOprema {
		var rentCount int64
		if err := tx.Model(&models.AkcijaOpremaRent{}).Where("akcija_oprema_id = ?", oprema.ID).Count(&rentCount).Error; err != nil {
			return err
		}
		if rentCount == 0 {
			if err := tx.Delete(&oprema).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func strPtr(s string) *string {
	return &s
}
