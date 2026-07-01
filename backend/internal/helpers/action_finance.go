package helpers

import (
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// PrijavaRentItem opisuje izabrani rent u prijavi.
type PrijavaRentItem struct {
	RentID   uint `json:"rentId"`
	Kolicina int  `json:"kolicina"`
}

// ParticipantChoices opisuje izbore logistike u prijavi.
type ParticipantChoices struct {
	SelectedSmestajIDs []uint
	SelectedPrevozIDs  []uint
	SelectedRentItems  []PrijavaRentItem
}

func ComputeBaseCenaForUser(akcija models.Akcija, korisnik models.Korisnik) float64 {
	if akcija.KlubID != nil && korisnik.KlubID != nil && *akcija.KlubID == *korisnik.KlubID {
		return akcija.CenaClan
	}
	if akcija.Javna {
		return akcija.CenaOstali
	}
	return akcija.CenaClan
}

func HasLogisticsChoices(smestaj []uint, prevoz []uint, rent []PrijavaRentItem) bool {
	if len(smestaj) > 0 || len(prevoz) > 0 {
		return true
	}
	for _, item := range rent {
		if item.RentID > 0 && item.Kolicina > 0 {
			return true
		}
	}
	return false
}

func IsActionGuide(akcija models.Akcija, korisnikID uint) bool {
	return akcija.VodicID > 0 && akcija.VodicID == korisnikID
}

func ComputeSaldoForParticipant(db *gorm.DB, akcija models.Akcija, korisnik models.Korisnik, choices ParticipantChoices) float64 {
	if IsActionGuide(akcija, korisnik.ID) && !HasLogisticsChoices(choices.SelectedSmestajIDs, choices.SelectedPrevozIDs, choices.SelectedRentItems) {
		return 0
	}
	saldo := ComputeBaseCenaForUser(akcija, korisnik)
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
	return saldo
}

func AkcijaSkipsClubFinances(akcija models.Akcija) bool {
	return strings.TrimSpace(strings.ToLower(akcija.OrganizatorTip)) == "vodic"
}

func ResolveFinanceRecorderID(tx *gorm.DB, actionClubID *uint, fallbackUserID uint) uint {
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
