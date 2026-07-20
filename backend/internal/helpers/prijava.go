package helpers

import (
	"errors"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PrijavaActiveStatuses — prijave koje troše kapacitet akcije.
var PrijavaActiveStatuses = []string{"prijavljen", "popeo se", "nije uspeo"}

var (
	ErrDuplicatePrijava      = errors.New("Već ste prijavljeni na ovu akciju.")
	ErrAkcijaCapacityFull    = errors.New("Akcija je popunjena.")
	ErrSignupClosed          = errors.New("Prijava na ovu akciju više nije moguća.")
	ErrMaxLjudiBelowActive   = errors.New("Kapacitet ne može biti manji od trenutnog broja prijavljenih učesnika.")
	ErrPendingSignupExists   = errors.New("Već imate zahtev za prijavu na čekanju")
	ErrAkcijaAlreadyComplete = errors.New("Akcija je već završena")
	ErrKorisnikNotEligible   = errors.New("Korisnik nije dostupan za prijavu.")
)

// ConfirmedPrijavaPolicy kontroliše koje invarijante CreateConfirmedPrijavaTx primjenjuje.
// RequireActionActive i ValidateSignupDeadline su namjerno odvojeni:
// lifecycle akcije (završena) != rok prijave za obične članove (datum/start).
type ConfirmedPrijavaPolicy struct {
	RequireActionActive    bool
	ValidateSignupDeadline bool
	CheckCapacity          bool
	RequireActiveUser      bool
}

// ConfirmedPrijavaPolicyMemberSignup — self-service / guide-booking prijava.
var ConfirmedPrijavaPolicyMemberSignup = ConfirmedPrijavaPolicy{
	RequireActionActive:    true,
	ValidateSignupDeadline: true,
	CheckCapacity:          true,
	RequireActiveUser:      true,
}

// ConfirmedPrijavaPolicyGuideAuto — automatska prijava vodiča pri kreiranju/izmjeni akcije.
// Preskače rok prijave članova, ali ne dozvoljava novu prijavu na završenoj akciji.
var ConfirmedPrijavaPolicyGuideAuto = ConfirmedPrijavaPolicy{
	RequireActionActive:    true,
	ValidateSignupDeadline: false,
	CheckCapacity:          true,
	RequireActiveUser:      true,
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

// CreateConfirmedPrijavaTx kreira potvrđenu prijavu (status "prijavljen") unutar postojeće transakcije.
// Idempotentno: ako prijava već postoji, vraća postojeći red bez greške.
func CreateConfirmedPrijavaTx(tx *gorm.DB, akcijaID, korisnikID uint, now time.Time, policy ConfirmedPrijavaPolicy) (models.Prijava, error) {
	if korisnikID == 0 {
		return models.Prijava{}, errors.New("invalid korisnik id")
	}

	locked, err := LockAkcijaForUpdate(tx, akcijaID)
	if err != nil {
		return models.Prijava{}, err
	}

	// Idempotentno: postojeća prijava se vraća prije lifecycle/deadline provjera,
	// tako da već prijavljeni vodič na završenoj akciji ne pravi grešku.
	var existing models.Prijava
	err = tx.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnikID).First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Prijava{}, err
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
				return raceExisting, nil
			}
		}
		return models.Prijava{}, MapCreatePrijavaError(err)
	}
	return prijava, nil
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
