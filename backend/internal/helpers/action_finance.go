package helpers

import (
	"encoding/json"
	"math"
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// saldoMoneyEpsilon — ista tolerancija kao u FinishAction (finEps).
const saldoMoneyEpsilon = 1e-6

// SaldoAmountsEqual poredi iznose obaveze izračunate kao float64.
func SaldoAmountsEqual(a, b float64) bool {
	return math.Abs(a-b) < saldoMoneyEpsilon
}

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

func participantChoicesFromJSON(smestajJSON, prevozJSON, rentJSON string) (ParticipantChoices, error) {
	out := ParticipantChoices{}
	if err := unmarshalChoiceIDs(smestajJSON, &out.SelectedSmestajIDs); err != nil {
		return ParticipantChoices{}, err
	}
	if err := unmarshalChoiceIDs(prevozJSON, &out.SelectedPrevozIDs); err != nil {
		return ParticipantChoices{}, err
	}
	if err := unmarshalRentItems(rentJSON, &out.SelectedRentItems); err != nil {
		return ParticipantChoices{}, err
	}
	return out, nil
}

func unmarshalChoiceIDs(raw string, dest *[]uint) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "null" {
		*dest = nil
		return nil
	}
	return json.Unmarshal([]byte(trimmed), dest)
}

func unmarshalRentItems(raw string, dest *[]PrijavaRentItem) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "null" {
		*dest = nil
		return nil
	}
	return json.Unmarshal([]byte(trimmed), dest)
}

func participantChoicesFromIzbori(izbor *models.PrijavaIzbori) (ParticipantChoices, error) {
	if izbor == nil {
		return ParticipantChoices{}, nil
	}
	return participantChoicesFromJSON(izbor.SelectedSmestajIDs, izbor.SelectedPrevozIDs, izbor.SelectedRentItemsRaw)
}

func participantChoicesFromPayload(payload PrijavaIzboriPayload) (ParticipantChoices, error) {
	return participantChoicesFromJSON(payload.SelectedSmestajIDs, payload.SelectedPrevozIDs, payload.SelectedRentItemsRaw)
}

// ShouldResetPlatioForReactivationTx vraća true kada prijava ima Platio=true, ali se finansijska
// obaveza (saldo) promijenila u odnosu na stare izbore. Koristi centralni ComputeSaldoForParticipant.
func ShouldResetPlatioForReactivationTx(
	tx *gorm.DB,
	prijava models.Prijava,
	oldIzbor *models.PrijavaIzbori,
	newChoices PrijavaIzboriPayload,
) (bool, error) {
	if !prijava.Platio {
		return false, nil
	}

	var akcija models.Akcija
	if err := tx.First(&akcija, prijava.AkcijaID).Error; err != nil {
		return false, err
	}
	var korisnik models.Korisnik
	if err := tx.First(&korisnik, prijava.KorisnikID).Error; err != nil {
		return false, err
	}

	oldChoices, err := participantChoicesFromIzbori(oldIzbor)
	if err != nil {
		return false, err
	}
	newChoicesParsed, err := participantChoicesFromPayload(newChoices)
	if err != nil {
		return false, err
	}

	oldSaldo := ComputeSaldoForParticipant(tx, akcija, korisnik, oldChoices)
	newSaldo := ComputeSaldoForParticipant(tx, akcija, korisnik, newChoicesParsed)
	return !SaldoAmountsEqual(oldSaldo, newSaldo), nil
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
