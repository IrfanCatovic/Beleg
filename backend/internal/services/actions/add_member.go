package actions

import (
	"errors"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrMemberAlreadySummited = errors.New("Član je već označen kao uspešno popeo se")
	ErrMemberNotInClub       = errors.New("Možete dodati samo člana kluba koji je domaćin akcije")
	ErrActionNotCompleted    = errors.New("Član se ovde može dodati tek kada je akcija završena")
)

type AddMemberResult struct {
	Prijava models.Prijava
	Message string
}

// AddMemberToCompletedAction dodaje ili ažurira prijavu kao "popeo se" na završenoj akciji.
// Prijava i korisnička statistika su u jednoj transakciji; notifikacija tek nakon commit-a.
func AddMemberToCompletedAction(db *gorm.DB, akcija *models.Akcija, korisnik *models.Korisnik) (*AddMemberResult, error) {
	if akcija == nil || akcija.ID == 0 || korisnik == nil || korisnik.ID == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	var shouldNotify bool
	var outPrijava models.Prijava

	err := db.Transaction(func(tx *gorm.DB) error {
		p, notify, err := addMemberToCompletedActionTx(tx, akcija.ID, korisnik.ID)
		if err != nil {
			return err
		}
		outPrijava = p
		shouldNotify = notify
		return nil
	})
	if err != nil {
		return nil, err
	}

	if shouldNotify {
		notifications.NotifySummitReward(db, korisnik.ID, *akcija)
	}

	return &AddMemberResult{
		Prijava: outPrijava,
		Message: "Član je dodat na završenu akciju kao uspešno popeo se",
	}, nil
}

// addMemberToCompletedActionTx — prijava + statistika unutar postojeće transakcije; bez notifikacija.
func addMemberToCompletedActionTx(tx *gorm.DB, akcijaID, korisnikID uint) (models.Prijava, bool, error) {
	var akcija models.Akcija
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&akcija, akcijaID).Error; err != nil {
		return models.Prijava{}, false, err
	}
	if !akcija.IsCompleted {
		return models.Prijava{}, false, ErrActionNotCompleted
	}

	var korisnik models.Korisnik
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&korisnik, korisnikID).Error; err != nil {
		return models.Prijava{}, false, err
	}
	if akcija.KlubID == nil || korisnik.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
		return models.Prijava{}, false, ErrMemberNotInClub
	}

	var prijava models.Prijava
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnikID).
		First(&prijava).Error

	newlySummited := false
	if errors.Is(err, gorm.ErrRecordNotFound) {
		prijava = models.Prijava{
			AkcijaID:   akcijaID,
			KorisnikID: korisnikID,
			Status:     "popeo se",
		}
		if createErr := tx.Create(&prijava).Error; createErr != nil {
			if helpers.IsDuplicatePrijavaDBError(createErr) {
				// Race: drugi request je već kreirao prijavu.
				if fetchErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
					Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnikID).
					First(&prijava).Error; fetchErr != nil {
					return models.Prijava{}, false, helpers.MapCreatePrijavaError(createErr)
				}
				if prijava.Status == "popeo se" {
					return models.Prijava{}, false, ErrMemberAlreadySummited
				}
				// Drugi status (npr. prijavljen) — preuzmi update putanju ispod.
			} else {
				return models.Prijava{}, false, helpers.MapCreatePrijavaError(createErr)
			}
		} else {
			newlySummited = true
		}
	} else if err != nil {
		return models.Prijava{}, false, err
	}

	if !newlySummited {
		if prijava.Status == "popeo se" {
			return models.Prijava{}, false, ErrMemberAlreadySummited
		}
		// prijavljen / nije uspeo / otkazano → popeo se (postojeća semantika: bilo koji ne-summit status se promovira).
		prijava.Status = "popeo se"
		if err := tx.Save(&prijava).Error; err != nil {
			return models.Prijava{}, false, err
		}
		newlySummited = true
	}

	if _, err := helpers.EnsurePrijavaIzboriTx(tx, prijava.ID); err != nil {
		return models.Prijava{}, false, err
	}

	shouldNotify := false
	if newlySummited && helpers.PrijavaCountsAsClimbedPeak(tx, &akcija, korisnikID) {
		// korisnik je već zaključan; inkrement na zaključanom redu sprečava lost-update.
		korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
		korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
		korisnik.BrojPopeoSe += 1
		if err := tx.Save(&korisnik).Error; err != nil {
			return models.Prijava{}, false, err
		}
		shouldNotify = true
	}

	return prijava, shouldNotify, nil
}
