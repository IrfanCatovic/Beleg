package helpers

import (
	"errors"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PrijavaStatusPrijavljen — neriješen status prijave (nema konačan rezultat).
const PrijavaStatusPrijavljen = "prijavljen"

// PrijavaActiveStatuses — prijave koje troše kapacitet akcije.
var PrijavaActiveStatuses = []string{PrijavaStatusPrijavljen, "popeo se", "nije uspeo"}

// PrijavaBlockingStatuses — postojeća prijava sa ovim statusom blokira novi signup zahtjev.
var PrijavaBlockingStatuses = []string{PrijavaStatusPrijavljen, "popeo se", "nije uspeo"}

var (
	ErrDuplicatePrijava                 = errors.New("Već ste prijavljeni na ovu akciju.")
	ErrAkcijaCapacityFull               = errors.New("Akcija je popunjena.")
	ErrSignupClosed                     = errors.New("Prijava na ovu akciju više nije moguća.")
	ErrMaxLjudiBelowActive              = errors.New("Kapacitet ne može biti manji od trenutnog broja prijavljenih učesnika.")
	ErrPendingSignupExists              = errors.New("Već imate zahtev za prijavu na čekanju")
	ErrAkcijaAlreadyComplete            = errors.New("Akcija je već završena")
	ErrKorisnikNotEligible              = errors.New("Korisnik nije dostupan za prijavu.")
	ErrAkcijaHasUnresolvedParticipants  = errors.New("Akcija se ne može završiti dok svi prijavljeni učesnici nemaju konačan status.")
)

// ConfirmedPrijavaPolicy kontroliše koje invarijante CreateConfirmedPrijavaTx primjenjuje.
// RequireActionActive i ValidateSignupDeadline su namjerno odvojeni:
// lifecycle akcije (završena) != rok prijave za obične članove (datum/start).
type ConfirmedPrijavaPolicy struct {
	RequireActionActive    bool
	ValidateSignupDeadline bool
	CheckCapacity          bool
	RequireActiveUser      bool
	// ReactivateCancelled: ako postoji prijava sa statusom "otkazano", reaktiviraj je u "prijavljen"
	// (samo za flowove koji eksplicitno osiguravaju potvrđenog učesnika, npr. guide-auto).
	ReactivateCancelled bool
}

// ConfirmedPrijavaPolicyMemberSignup — self-service / guide-booking prijava.
var ConfirmedPrijavaPolicyMemberSignup = ConfirmedPrijavaPolicy{
	RequireActionActive:    true,
	ValidateSignupDeadline: true,
	CheckCapacity:          true,
	RequireActiveUser:      true,
	ReactivateCancelled:    false,
}

// ConfirmedPrijavaPolicyGuideAuto — automatska prijava vodiča pri kreiranju/izmjeni akcije.
// Preskače rok prijave članova, ali ne dozvoljava novu prijavu na završenoj akciji.
var ConfirmedPrijavaPolicyGuideAuto = ConfirmedPrijavaPolicy{
	RequireActionActive:    true,
	ValidateSignupDeadline: false,
	CheckCapacity:          true,
	RequireActiveUser:      true,
	ReactivateCancelled:    true,
}

func belgradeLocation() *time.Location {
	loc, err := time.LoadLocation("Europe/Belgrade")
	if err != nil {
		return time.UTC
	}
	return loc
}

// ValidateAkcijaActive proverava lifecycle stanje akcije (nije završena).
// Otkazani status na akciji trenutno ne postoji u modelu — kada se uvede, dodati ovdje.
func ValidateAkcijaActive(akcija *models.Akcija) error {
	if akcija == nil {
		return ErrSignupClosed
	}
	if akcija.IsCompleted {
		return ErrAkcijaAlreadyComplete
	}
	return nil
}

// ValidateAkcijaSignupDeadline proverava rok prijave za obične članove (start/datum).
// Ne provjerava IsCompleted — to radi ValidateAkcijaActive.
func ValidateAkcijaSignupDeadline(akcija *models.Akcija, now time.Time) error {
	if akcija == nil {
		return ErrSignupClosed
	}
	if akcija.StartAt != nil && now.After(*akcija.StartAt) {
		return ErrSignupClosed
	}
	if akcija.StartAt == nil {
		loc := belgradeLocation()
		localNow := now.In(loc)
		today := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, loc)
		d := akcija.Datum.In(loc)
		actionDay := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, loc)
		if actionDay.Before(today) {
			return ErrSignupClosed
		}
	}
	return nil
}

// ValidateAkcijaSignupOpen proverava da li je akcija otvorena za novu prijavu člana
// (aktivna + rok nije istekao). Kompozicija ValidateAkcijaActive + ValidateAkcijaSignupDeadline.
func ValidateAkcijaSignupOpen(akcija *models.Akcija, now time.Time) error {
	if err := ValidateAkcijaActive(akcija); err != nil {
		return err
	}
	return ValidateAkcijaSignupDeadline(akcija, now)
}

// CountActivePrijaveForAkcija broji prijave koje troše kapacitet.
func CountActivePrijaveForAkcija(tx *gorm.DB, akcijaID uint) (int64, error) {
	var n int64
	err := tx.Model(&models.Prijava{}).
		Where("akcija_id = ? AND status IN ?", akcijaID, PrijavaActiveStatuses).
		Count(&n).Error
	return n, err
}

// HasPrijavaForUser vraća true ako korisnik već ima bilo koji zapis prijave za akciju.
func HasPrijavaForUser(tx *gorm.DB, akcijaID, korisnikID uint) (bool, error) {
	var n int64
	err := tx.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnikID).
		Count(&n).Error
	return n > 0, err
}

// HasBlockingPrijavaForUser vraća true ako korisnik ima prijavu koja blokira novi signup zahtjev.
// Status "otkazano" ne blokira — korisnik može poslati novi pending zahtjev.
func HasBlockingPrijavaForUser(tx *gorm.DB, akcijaID, korisnikID uint) (bool, error) {
	var n int64
	err := tx.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ? AND status IN ?", akcijaID, korisnikID, PrijavaBlockingStatuses).
		Count(&n).Error
	return n > 0, err
}

// PrijavaIzboriPayload — serializovani izbori za upsert pri reaktivaciji ili kreiranju.
type PrijavaIzboriPayload struct {
	SelectedSmestajIDs   string
	SelectedPrevozIDs    string
	SelectedRentItemsRaw string
}

// ReactivateCancelledPrijavaFromChoicesTx reaktivira postojeću prijavu sa statusom "otkazano".
// Pozivalac mora prethodno validirati izbore; helper ne otvara sopstvenu transakciju.
func ReactivateCancelledPrijavaFromChoicesTx(tx *gorm.DB, prijavaID uint, choices PrijavaIzboriPayload) (models.Prijava, error) {
	if prijavaID == 0 {
		return models.Prijava{}, errors.New("invalid prijava id")
	}

	var prijava models.Prijava
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&prijava, prijavaID).Error; err != nil {
		return models.Prijava{}, err
	}
	if prijava.Status != "otkazano" {
		return models.Prijava{}, ErrDuplicatePrijava
	}

	var oldIzbor *models.PrijavaIzbori
	var izborRecord models.PrijavaIzbori
	if err := tx.Where("prijava_id = ?", prijavaID).First(&izborRecord).Error; err == nil {
		oldIzbor = &izborRecord
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Prijava{}, err
	}

	resetPlatio, err := HasFinancialObligationChangedTx(tx, prijava, oldIzbor, choices)
	if err != nil {
		return models.Prijava{}, err
	}
	newPlatio := prijava.Platio
	if resetPlatio {
		newPlatio = false
	}

	if err := tx.Model(&prijava).Updates(map[string]any{
		"status": "prijavljen",
		"platio": newPlatio,
	}).Error; err != nil {
		return models.Prijava{}, err
	}
	prijava.Status = "prijavljen"
	prijava.Platio = newPlatio

	var izbor models.PrijavaIzbori
	err = tx.Where("prijava_id = ?", prijavaID).First(&izbor).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		izbor = models.PrijavaIzbori{
			PrijavaID:            prijavaID,
			SelectedSmestajIDs:   choices.SelectedSmestajIDs,
			SelectedPrevozIDs:    choices.SelectedPrevozIDs,
			SelectedRentItemsRaw: choices.SelectedRentItemsRaw,
		}
		if createErr := tx.Create(&izbor).Error; createErr != nil {
			if IsDuplicatePrijavaIzboriDBError(createErr) {
				var raced models.PrijavaIzbori
				if fetchErr := tx.Where("prijava_id = ?", prijavaID).First(&raced).Error; fetchErr != nil {
					return models.Prijava{}, fetchErr
				}
				raced.SelectedSmestajIDs = choices.SelectedSmestajIDs
				raced.SelectedPrevozIDs = choices.SelectedPrevozIDs
				raced.SelectedRentItemsRaw = choices.SelectedRentItemsRaw
				if saveErr := tx.Save(&raced).Error; saveErr != nil {
					return models.Prijava{}, saveErr
				}
			} else {
				return models.Prijava{}, createErr
			}
		}
	} else if err != nil {
		return models.Prijava{}, err
	} else {
		izbor.SelectedSmestajIDs = choices.SelectedSmestajIDs
		izbor.SelectedPrevozIDs = choices.SelectedPrevozIDs
		izbor.SelectedRentItemsRaw = choices.SelectedRentItemsRaw
		if err := tx.Save(&izbor).Error; err != nil {
			return models.Prijava{}, err
		}
	}

	return prijava, nil
}

// HasPendingSignupRequest vraća true ako korisnik ima pending signup za akciju.
func HasPendingSignupRequest(tx *gorm.DB, akcijaID, requesterID uint) (bool, error) {
	var n int64
	err := tx.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND requester_id = ? AND status = ?", akcijaID, requesterID, models.ActionSignupRequestPending).
		Count(&n).Error
	return n > 0, err
}

// LockAkcijaForUpdate zaključava red akcije unutar transakcije (SELECT FOR UPDATE).
func LockAkcijaForUpdate(tx *gorm.DB, akcijaID uint) (*models.Akcija, error) {
	var akcija models.Akcija
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&akcija, akcijaID).Error; err != nil {
		return nil, err
	}
	return &akcija, nil
}

// LockPrijavaForUpdate zaključava red prijave unutar transakcije (SELECT FOR UPDATE).
// Pozivalac mora prethodno zaključati akciju (Akcija → Prijava redoslijed).
func LockPrijavaForUpdate(tx *gorm.DB, prijavaID uint) (*models.Prijava, error) {
	var prijava models.Prijava
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&prijava, prijavaID).Error; err != nil {
		return nil, err
	}
	return &prijava, nil
}

// LockActionSignupRequestForUpdate zaključava signup request (SELECT FOR UPDATE).
// Pozivalac mora prethodno zaključati akciju (Akcija → ActionSignupRequest).
func LockActionSignupRequestForUpdate(tx *gorm.DB, requestID uint) (*models.ActionSignupRequest, error) {
	var req models.ActionSignupRequest
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&req, requestID).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

// LockPrijaveForAkcijaForUpdate zaključava sve prijave akcije (ORDER BY id FOR UPDATE).
// Pozivalac mora prethodno zaključati akciju (Akcija → Prijava redoslijed).
func LockPrijaveForAkcijaForUpdate(tx *gorm.DB, akcijaID uint) ([]models.Prijava, error) {
	var prijave []models.Prijava
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("akcija_id = ?", akcijaID).
		Order("id").
		Find(&prijave).Error
	return prijave, err
}

// EnsureNoUnresolvedParticipantResultsTx odbija finish dok postoji status=prijavljen.
// Poziva se nakon eventualne guide auto-promotion, nad zaključanim skupom prijava.
func EnsureNoUnresolvedParticipantResultsTx(tx *gorm.DB, akcijaID uint) error {
	var n int64
	if err := tx.Model(&models.Prijava{}).
		Where("akcija_id = ? AND status = ?", akcijaID, PrijavaStatusPrijavljen).
		Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return ErrAkcijaHasUnresolvedParticipants
	}
	return nil
}

// EnsureCapacityAvailable proverava da li ima slobodnih mesta (maxLjudi=0 → neograničeno).
func EnsureCapacityAvailable(tx *gorm.DB, akcijaID uint, maxLjudi int) error {
	if maxLjudi <= 0 {
		return nil
	}
	n, err := CountActivePrijaveForAkcija(tx, akcijaID)
	if err != nil {
		return err
	}
	if n >= int64(maxLjudi) {
		return ErrAkcijaCapacityFull
	}
	return nil
}

// ValidateMaxLjudiNotBelowActive odbija smanjenje kapaciteta ispod trenutnog broja aktivnih prijava.
func ValidateMaxLjudiNotBelowActive(db *gorm.DB, akcijaID uint, newMaxLjudi int) error {
	if newMaxLjudi <= 0 {
		return nil
	}
	n, err := CountActivePrijaveForAkcija(db, akcijaID)
	if err != nil {
		return err
	}
	if int64(newMaxLjudi) < n {
		return ErrMaxLjudiBelowActive
	}
	return nil
}

// IsDuplicatePrijavaDBError detektuje unique constraint na (akcija_id, korisnik_id).
func IsDuplicatePrijavaDBError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") &&
		(strings.Contains(msg, "prijav") || strings.Contains(msg, "idx_prijave_akcija_korisnik"))
}

// MapCreatePrijavaError mapira DB duplicate u korisničku poruku.
func MapCreatePrijavaError(err error) error {
	if IsDuplicatePrijavaDBError(err) {
		return ErrDuplicatePrijava
	}
	return err
}

// reactivateCancelledConfirmedPrijavaTx postavlja status "prijavljen" na zaključanom otkazanom redu.
// Pozivalac mora prethodno proći policy provjere; ne mijenja izbore ni Platio.
func reactivateCancelledConfirmedPrijavaTx(tx *gorm.DB, prijavaID uint) (models.Prijava, error) {
	var prijava models.Prijava
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&prijava, prijavaID).Error; err != nil {
		return models.Prijava{}, err
	}
	if prijava.Status != "otkazano" {
		if prijava.Status == "prijavljen" || prijava.Status == "popeo se" || prijava.Status == "nije uspeo" {
			return prijava, nil
		}
		return models.Prijava{}, ErrDuplicatePrijava
	}
	if err := tx.Model(&prijava).Update("status", "prijavljen").Error; err != nil {
		return models.Prijava{}, err
	}
	prijava.Status = "prijavljen"
	return prijava, nil
}

// CreateConfirmedPrijavaTx kreira potvrđenu prijavu (status "prijavljen") unutar postojeće transakcije.
// Idempotentno: aktivni statusi (prijavljen / popeo se / nije uspeo) vraćaju postojeći red bez greške.
// Sa ReactivateCancelled: otkazano se reaktivira u prijavljen nakon policy provjera.
func CreateConfirmedPrijavaTx(tx *gorm.DB, akcijaID, korisnikID uint, now time.Time, policy ConfirmedPrijavaPolicy) (models.Prijava, error) {
	if korisnikID == 0 {
		return models.Prijava{}, errors.New("invalid korisnik id")
	}

	locked, err := LockAkcijaForUpdate(tx, akcijaID)
	if err != nil {
		return models.Prijava{}, err
	}

	var existing models.Prijava
	fetchErr := tx.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnikID).First(&existing).Error
	if fetchErr == nil {
		if existing.Status != "otkazano" {
			return existing, nil
		}
		if !policy.ReactivateCancelled {
			return existing, nil
		}
	} else if !errors.Is(fetchErr, gorm.ErrRecordNotFound) {
		return models.Prijava{}, fetchErr
	}

	if policy.RequireActionActive {
		if err := ValidateAkcijaActive(locked); err != nil {
			return models.Prijava{}, err
		}
	}
	if policy.ValidateSignupDeadline {
		if err := ValidateAkcijaSignupDeadline(locked, now); err != nil {
			return models.Prijava{}, err
		}
	}

	if policy.RequireActiveUser {
		var korisnik models.Korisnik
		if err := tx.First(&korisnik, korisnikID).Error; err != nil {
			return models.Prijava{}, err
		}
		if strings.EqualFold(strings.TrimSpace(korisnik.Role), "deleted") {
			return models.Prijava{}, ErrKorisnikNotEligible
		}
	}

	if policy.CheckCapacity {
		if err := EnsureCapacityAvailable(tx, akcijaID, locked.MaxLjudi); err != nil {
			return models.Prijava{}, err
		}
	}

	if fetchErr == nil && existing.Status == "otkazano" {
		return reactivateCancelledConfirmedPrijavaTx(tx, existing.ID)
	}

	prijava := models.Prijava{
		AkcijaID:   akcijaID,
		KorisnikID: korisnikID,
		Status:     "prijavljen",
		Platio:     false,
	}
	if err := tx.Create(&prijava).Error; err != nil {
		if mapped := MapCreatePrijavaError(err); errors.Is(mapped, ErrDuplicatePrijava) {
			var raceExisting models.Prijava
			if fetchErr := tx.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnikID).First(&raceExisting).Error; fetchErr == nil {
				if raceExisting.Status == "otkazano" && policy.ReactivateCancelled {
					return reactivateCancelledConfirmedPrijavaTx(tx, raceExisting.ID)
				}
				return raceExisting, nil
			}
		}
		return models.Prijava{}, MapCreatePrijavaError(err)
	}
	return prijava, nil
}

const emptyPrijavaIzboriJSON = "[]"

// IsDuplicatePrijavaIzboriDBError detektuje unique constraint na prijava_izbori.prijava_id.
func IsDuplicatePrijavaIzboriDBError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") &&
		(strings.Contains(msg, "prijava_izbori") ||
			strings.Contains(msg, "idx_prijava_izbori_prijava_id") ||
			(strings.Contains(msg, "prijava_id") && strings.Contains(msg, "izbor")))
}

// EnsurePrijavaIzboriTx osigurava tačno jedan PrijavaIzbori red za prijavu.
// Ako red ne postoji, kreira prazan validan zapis (JSON "[]"). Idempotentan.
// Prima transaction-aware *gorm.DB; ne otvara sopstvenu transakciju.
func EnsurePrijavaIzboriTx(tx *gorm.DB, prijavaID uint) (models.PrijavaIzbori, error) {
	if prijavaID == 0 {
		return models.PrijavaIzbori{}, errors.New("invalid prijava id")
	}
	var existing models.PrijavaIzbori
	err := tx.Where("prijava_id = ?", prijavaID).First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.PrijavaIzbori{}, err
	}

	izbor := models.PrijavaIzbori{
		PrijavaID:            prijavaID,
		SelectedSmestajIDs:   emptyPrijavaIzboriJSON,
		SelectedPrevozIDs:    emptyPrijavaIzboriJSON,
		SelectedRentItemsRaw: emptyPrijavaIzboriJSON,
	}
	if createErr := tx.Create(&izbor).Error; createErr != nil {
		if IsDuplicatePrijavaIzboriDBError(createErr) {
			var raced models.PrijavaIzbori
			if fetchErr := tx.Where("prijava_id = ?", prijavaID).First(&raced).Error; fetchErr == nil {
				return raced, nil
			}
		}
		return models.PrijavaIzbori{}, createErr
	}
	return izbor, nil
}

// IsDuplicatePendingSignupDBError detektuje partial unique na pending signup.
func IsDuplicatePendingSignupDBError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") &&
		(strings.Contains(msg, "idx_signup_pending_unique") ||
			strings.Contains(msg, "action_signup_requests"))
}

// MapCreateSignupRequestError mapira DB duplicate pending signup.
func MapCreateSignupRequestError(err error) error {
	if IsDuplicatePendingSignupDBError(err) {
		return ErrPendingSignupExists
	}
	return err
}
