package helpers

import (
	"errors"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

var (
	ErrAkcijaHardDeleteCompleted         = errors.New("Završena akcija se ne može trajno obrisati.")
	ErrAkcijaHardDeleteCancelled         = errors.New("Otkazana akcija se ne može trajno obrisati.")
	ErrAkcijaHardDeleteHasPrijave        = errors.New("Akcija sa učesnicima ili istorijom prijava ne može se trajno obrisati.")
	ErrAkcijaHardDeleteHasSignupRequests = errors.New("Akcija sa zahtevima za prijavu ne može se trajno obrisati.")
)

// ValidateAkcijaCanBeHardDeletedTx provjerava da li je akcija prazna draft greška
// (nezavršena, neotkazana, bez prijava i signup zahtjeva). Pozivalac mora proslijediti zaključani red.
func ValidateAkcijaCanBeHardDeletedTx(tx *gorm.DB, akcija *models.Akcija) error {
	if akcija == nil {
		return gorm.ErrRecordNotFound
	}
	if akcija.IsCancelled {
		return ErrAkcijaHardDeleteCancelled
	}
	if akcija.IsCompleted {
		return ErrAkcijaHardDeleteCompleted
	}

	var prijavaCount int64
	if err := tx.Model(&models.Prijava{}).Where("akcija_id = ?", akcija.ID).Count(&prijavaCount).Error; err != nil {
		return err
	}
	if prijavaCount > 0 {
		return ErrAkcijaHardDeleteHasPrijave
	}

	var signupCount int64
	if err := tx.Model(&models.ActionSignupRequest{}).Where("akcija_id = ?", akcija.ID).Count(&signupCount).Error; err != nil {
		return err
	}
	if signupCount > 0 {
		return ErrAkcijaHardDeleteHasSignupRequests
	}

	return nil
}
