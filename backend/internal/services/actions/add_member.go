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

// completedMemberApplyOpts kontroliše per-member razlike između single i bulk flowa.
// Status/statistika/PrijavaIzbori invarijante su iste; Platio i club skip su bulk-specifični.
type completedMemberApplyOpts struct {
	requireClubMember bool
	setPlatio         bool
}

type completedMemberApplyResult struct {
	outcome      string // added, updated, skipped
	reason       string
	prijava      models.Prijava
	shouldNotify bool
}

// lockCompletedAkcijaTx učitava i zaključava akciju; provjerava da je završena.
func lockCompletedAkcijaTx(tx *gorm.DB, akcijaID uint) (models.Akcija, error) {
	var akcija models.Akcija
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&akcija, akcijaID).Error; err != nil {
		return models.Akcija{}, err
	}
	if akcija.IsCancelled {
		return models.Akcija{}, helpers.ErrAkcijaCancelled
	}
	if !akcija.IsCompleted {
		return models.Akcija{}, ErrActionNotCompleted
	}
	return akcija, nil
}

// applyCompletedActionMemberTx obrađuje jednog korisnika unutar postojeće transakcije.
// Completed-action add/bulk ne koristi maxLjudi kao signup kapacitet.
// Ne otvara transakciju, ne šalje notifikacije.
func applyCompletedActionMemberTx(
	tx *gorm.DB,
	akcija *models.Akcija,
	korisnikID uint,
	opts completedMemberApplyOpts,
) (completedMemberApplyResult, error) {
	var korisnik models.Korisnik
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&korisnik, korisnikID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return completedMemberApplyResult{outcome: "skipped", reason: "korisnik nije pronađen"}, nil
		}
		return completedMemberApplyResult{}, err
	}
	if korisnik.Role == "deleted" {
		return completedMemberApplyResult{outcome: "skipped", reason: "korisnik je deaktiviran"}, nil
	}
	if opts.requireClubMember {
		if akcija.KlubID == nil || korisnik.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
			return completedMemberApplyResult{outcome: "skipped", reason: "korisnik nije član domaćeg kluba"}, nil
		}
	}

	var prijava models.Prijava
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnikID).
		First(&prijava).Error

	outcome := ""
	newlySummited := false
	if errors.Is(err, gorm.ErrRecordNotFound) {
		prijava = models.Prijava{
			AkcijaID:   akcija.ID,
			KorisnikID: korisnikID,
			Status:     "popeo se",
		}
		if opts.setPlatio {
			prijava.Platio = true
		}
		if createErr := tx.Create(&prijava).Error; createErr != nil {
			if helpers.IsDuplicatePrijavaDBError(createErr) {
				if fetchErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
					Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnikID).
					First(&prijava).Error; fetchErr != nil {
					return completedMemberApplyResult{}, helpers.MapCreatePrijavaError(createErr)
				}
				if prijava.Status == "popeo se" {
					return completedMemberApplyResult{
						outcome: "skipped",
						reason:  "već označen kao popeo se",
						prijava: prijava,
					}, nil
				}
			} else {
				return completedMemberApplyResult{}, helpers.MapCreatePrijavaError(createErr)
			}
		} else {
			outcome = "added"
			newlySummited = true
		}
	} else if err != nil {
		return completedMemberApplyResult{}, err
	}

	if outcome == "" {
		if prijava.Status == "popeo se" {
			return completedMemberApplyResult{
				outcome: "skipped",
				reason:  "već označen kao popeo se",
				prijava: prijava,
			}, nil
		}
		// prijavljen / nije uspeo / otkazano → popeo se
		prijava.Status = "popeo se"
		if opts.setPlatio {
			prijava.Platio = true
		}
		if err := tx.Save(&prijava).Error; err != nil {
			return completedMemberApplyResult{}, err
		}
		outcome = "updated"
		newlySummited = true
	}

	if _, err := helpers.EnsurePrijavaIzboriTx(tx, prijava.ID); err != nil {
		return completedMemberApplyResult{}, err
	}

	shouldNotify := false
	if newlySummited && helpers.PrijavaCountsAsClimbedPeak(tx, akcija, korisnikID) {
		korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
		korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
		korisnik.BrojPopeoSe += 1
		if err := tx.Save(&korisnik).Error; err != nil {
			return completedMemberApplyResult{}, err
		}
		shouldNotify = true
	}

	return completedMemberApplyResult{
		outcome:      outcome,
		prijava:      prijava,
		shouldNotify: shouldNotify,
	}, nil
}

func mapCompletedMemberSkipToError(reason string) error {
	switch reason {
	case "već označen kao popeo se":
		return ErrMemberAlreadySummited
	case "korisnik nije član domaćeg kluba":
		return ErrMemberNotInClub
	case "korisnik nije pronađen":
		return gorm.ErrRecordNotFound
	case "korisnik je deaktiviran":
		return ErrMemberNotInClub
	default:
		return errors.New(reason)
	}
}

// AddMemberToCompletedAction dodaje ili ažurira prijavu kao "popeo se" na završenoj akciji.
// Prijava, statistika i PrijavaIzbori su u jednoj transakciji; notifikacija tek nakon commit-a.
func AddMemberToCompletedAction(db *gorm.DB, akcija *models.Akcija, korisnik *models.Korisnik) (*AddMemberResult, error) {
	if akcija == nil || akcija.ID == 0 || korisnik == nil || korisnik.ID == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	var shouldNotify bool
	var outPrijava models.Prijava

	err := db.Transaction(func(tx *gorm.DB) error {
		lockedAkcija, err := lockCompletedAkcijaTx(tx, akcija.ID)
		if err != nil {
			return err
		}
		result, err := applyCompletedActionMemberTx(tx, &lockedAkcija, korisnik.ID, completedMemberApplyOpts{
			requireClubMember: true,
			setPlatio:         false,
		})
		if err != nil {
			return err
		}
		if result.outcome == "skipped" {
			return mapCompletedMemberSkipToError(result.reason)
		}
		outPrijava = result.prijava
		shouldNotify = result.shouldNotify
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
