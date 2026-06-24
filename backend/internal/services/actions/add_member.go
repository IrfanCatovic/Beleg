package actions

import (
	"errors"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"gorm.io/gorm"
)

var (
	ErrMemberAlreadySummited = errors.New("Član je već označen kao uspešno popeo se")
	ErrMemberNotInClub       = errors.New("Možete dodati samo člana kluba koji je domaćin akcije")
)

type AddMemberResult struct {
	Prijava models.Prijava
	Message string
}

// AddMemberToCompletedAction dodaje ili ažurira prijavu kao "popeo se" na završenoj akciji.
func AddMemberToCompletedAction(db *gorm.DB, akcija *models.Akcija, korisnik *models.Korisnik) (*AddMemberResult, error) {
	if akcija.KlubID == nil || korisnik.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
		return nil, ErrMemberNotInClub
	}

	var prijava models.Prijava
	err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		prijava = models.Prijava{
			AkcijaID:   akcija.ID,
			KorisnikID: korisnik.ID,
			Status:     "popeo se",
		}
		if err := db.Create(&prijava).Error; err != nil {
			return nil, err
		}
	} else {
		if prijava.Status == "popeo se" {
			return nil, ErrMemberAlreadySummited
		}
		prijava.Status = "popeo se"
		if err := db.Save(&prijava).Error; err != nil {
			return nil, err
		}
	}

	if helpers.PrijavaCountsAsClimbedPeak(db, akcija, korisnik.ID) {
		korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
		korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
		korisnik.BrojPopeoSe += 1
		if err := db.Save(korisnik).Error; err != nil {
			return nil, err
		}
		notifications.NotifySummitReward(db, korisnik.ID, *akcija)
	}

	return &AddMemberResult{
		Prijava: prijava,
		Message: "Član je dodat na završenu akciju kao uspešno popeo se",
	}, nil
}
