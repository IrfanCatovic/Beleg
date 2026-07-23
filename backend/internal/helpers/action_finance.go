package helpers

import (
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// ErrCompletedActionFinancialsImmutable vraća se kada se pokuša promijeniti finansijsku
// konfiguraciju akcije koja je već završena.
var ErrCompletedActionFinancialsImmutable = errors.New("Finansijski podaci završene akcije ne mogu se mijenjati.")

// ErrCompletedActionPaymentCannotBeUnset vraća se kada se pokuša poništiti
// evidentiranu uplatu (Platio true→false) na završenoj akciji.
var ErrCompletedActionPaymentCannotBeUnset = errors.New("Evidentirana uplata na završenoj akciji ne može biti poništena.")

// ErrPrijavaAkcijaMismatch vraća se kada zaključana prijava ne pripada zaključanoj akciji.
var ErrPrijavaAkcijaMismatch = errors.New("Prijava ne pripada ovoj akciji")

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

// HasFinancialObligationChangedTx vraća true kada prijava ima Platio=true i finansijska obaveza
// (saldo) se promijenila u odnosu na stare izbore. Koristi centralni ComputeSaldoForParticipant.
// Koristi se i pri reaktivaciji otkazane prijave i pri izmjeni izbora potvrđene prijave.
func HasFinancialObligationChangedTx(
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

// ActionFinancialSmestajEntry opisuje finansijski relevantnu smeštaj opciju.
type ActionFinancialSmestajEntry struct {
	Key               string
	CenaPoOsobiUkupno float64
}

// ActionFinancialPrevozEntry opisuje finansijski relevantnu prevoz opciju.
type ActionFinancialPrevozEntry struct {
	Key         string
	CenaPoOsobi float64
}

// ActionFinancialRentEntry opisuje finansijski relevantnu rent opciju.
type ActionFinancialRentEntry struct {
	Key        string
	CenaPoSetu float64
}

// ActionFinancialSnapshot hvata sva action-side polja koja utiču na ComputeSaldoForParticipant.
type ActionFinancialSnapshot struct {
	CenaClan   float64
	CenaOstali float64
	Javna      bool
	VodicID    uint
	Smestaj    []ActionFinancialSmestajEntry
	Prevoz     []ActionFinancialPrevozEntry
	Rent       []ActionFinancialRentEntry
}

func normalizeFinancialKey(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func smestajFinancialKey(naziv string) string {
	return normalizeFinancialKey(naziv)
}

func prevozFinancialKey(tip, grupa string) string {
	return normalizeFinancialKey(tip) + "|" + normalizeFinancialKey(grupa)
}

func rentFinancialKey(naziv string) string {
	return normalizeFinancialKey(naziv)
}

// LoadActionFinancialSnapshotTx učitava finansijski fingerprint akcije iz transaction-aware tx.
func LoadActionFinancialSnapshotTx(tx *gorm.DB, akcijaID uint, akcija models.Akcija) (ActionFinancialSnapshot, error) {
	snap := ActionFinancialSnapshot{
		CenaClan:   akcija.CenaClan,
		CenaOstali: akcija.CenaOstali,
		Javna:      akcija.Javna,
		VodicID:    akcija.VodicID,
	}

	var smestaj []models.AkcijaSmestaj
	if err := tx.Where("akcija_id = ?", akcijaID).Find(&smestaj).Error; err != nil {
		return ActionFinancialSnapshot{}, err
	}
	for _, row := range smestaj {
		snap.Smestaj = append(snap.Smestaj, ActionFinancialSmestajEntry{
			Key:               smestajFinancialKey(row.Naziv),
			CenaPoOsobiUkupno: row.CenaPoOsobiUkupno,
		})
	}
	sort.Slice(snap.Smestaj, func(i, j int) bool { return snap.Smestaj[i].Key < snap.Smestaj[j].Key })

	var prevoz []models.AkcijaPrevoz
	if err := tx.Where("akcija_id = ?", akcijaID).Find(&prevoz).Error; err != nil {
		return ActionFinancialSnapshot{}, err
	}
	for _, row := range prevoz {
		snap.Prevoz = append(snap.Prevoz, ActionFinancialPrevozEntry{
			Key:         prevozFinancialKey(row.TipPrevoza, row.NazivGrupe),
			CenaPoOsobi: row.CenaPoOsobi,
		})
	}
	sort.Slice(snap.Prevoz, func(i, j int) bool { return snap.Prevoz[i].Key < snap.Prevoz[j].Key })

	var rent []models.AkcijaOpremaRent
	if err := tx.Where("akcija_id = ?", akcijaID).Find(&rent).Error; err != nil {
		return ActionFinancialSnapshot{}, err
	}
	for _, row := range rent {
		snap.Rent = append(snap.Rent, ActionFinancialRentEntry{
			Key:        rentFinancialKey(row.NazivOpreme),
			CenaPoSetu: row.CenaPoSetu,
		})
	}
	sort.Slice(snap.Rent, func(i, j int) bool { return snap.Rent[i].Key < snap.Rent[j].Key })

	return snap, nil
}

// ActionFinancialSnapshotsEqual poredi dva finansijska fingerprint-a deterministički.
func ActionFinancialSnapshotsEqual(a, b ActionFinancialSnapshot) bool {
	aSmestaj := append([]ActionFinancialSmestajEntry(nil), a.Smestaj...)
	bSmestaj := append([]ActionFinancialSmestajEntry(nil), b.Smestaj...)
	sort.Slice(aSmestaj, func(i, j int) bool { return aSmestaj[i].Key < aSmestaj[j].Key })
	sort.Slice(bSmestaj, func(i, j int) bool { return bSmestaj[i].Key < bSmestaj[j].Key })

	aPrevoz := append([]ActionFinancialPrevozEntry(nil), a.Prevoz...)
	bPrevoz := append([]ActionFinancialPrevozEntry(nil), b.Prevoz...)
	sort.Slice(aPrevoz, func(i, j int) bool { return aPrevoz[i].Key < aPrevoz[j].Key })
	sort.Slice(bPrevoz, func(i, j int) bool { return bPrevoz[i].Key < bPrevoz[j].Key })

	aRent := append([]ActionFinancialRentEntry(nil), a.Rent...)
	bRent := append([]ActionFinancialRentEntry(nil), b.Rent...)
	sort.Slice(aRent, func(i, j int) bool { return aRent[i].Key < aRent[j].Key })
	sort.Slice(bRent, func(i, j int) bool { return bRent[i].Key < bRent[j].Key })

	if !SaldoAmountsEqual(a.CenaClan, b.CenaClan) || !SaldoAmountsEqual(a.CenaOstali, b.CenaOstali) {
		return false
	}
	if a.Javna != b.Javna || a.VodicID != b.VodicID {
		return false
	}
	if len(aSmestaj) != len(bSmestaj) {
		return false
	}
	for i := range aSmestaj {
		if aSmestaj[i].Key != bSmestaj[i].Key ||
			!SaldoAmountsEqual(aSmestaj[i].CenaPoOsobiUkupno, bSmestaj[i].CenaPoOsobiUkupno) {
			return false
		}
	}
	if len(aPrevoz) != len(bPrevoz) {
		return false
	}
	for i := range aPrevoz {
		if aPrevoz[i].Key != bPrevoz[i].Key ||
			!SaldoAmountsEqual(aPrevoz[i].CenaPoOsobi, bPrevoz[i].CenaPoOsobi) {
			return false
		}
	}
	if len(aRent) != len(bRent) {
		return false
	}
	for i := range aRent {
		if aRent[i].Key != bRent[i].Key ||
			!SaldoAmountsEqual(aRent[i].CenaPoSetu, bRent[i].CenaPoSetu) {
			return false
		}
	}
	return true
}

// ResetPaidPrijaveForFinancialChangeTx postavlja Platio=false za sve plaćene prijave
// aktivne akcije čiji status ulazi u kapacitet/payment praćenje.
func ResetPaidPrijaveForFinancialChangeTx(tx *gorm.DB, akcijaID uint) (int64, error) {
	result := tx.Model(&models.Prijava{}).
		Where("akcija_id = ? AND platio = ? AND status IN ?", akcijaID, true, PrijavaActiveStatuses).
		Update("platio", false)
	return result.RowsAffected, result.Error
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
