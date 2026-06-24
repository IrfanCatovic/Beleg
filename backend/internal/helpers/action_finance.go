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

func ComputeBaseCenaForUser(akcija models.Akcija, korisnik models.Korisnik) float64 {
	if akcija.KlubID != nil && korisnik.KlubID != nil && *akcija.KlubID == *korisnik.KlubID {
		return akcija.CenaClan
	}
	if akcija.Javna {
		return akcija.CenaOstali
	}
	return akcija.CenaClan
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
