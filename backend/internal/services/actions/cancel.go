package actions

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

var (
	ErrCancelReasonInvalid = errors.New("Razlog otkazivanja mora imati između 3 i 500 karaktera.")
	ErrCancelUnauthorized  = errors.New("Nemate pravo da otkažete ovu akciju")
)

type CancelActionRequest struct {
	Reason string `json:"reason"`
}

// NormalizeCancelReason trimuje razlog i validira Unicode dužinu (3–500 runa).
func NormalizeCancelReason(reason string) (string, error) {
	trimmed := strings.TrimSpace(reason)
	n := utf8.RuneCountInString(trimmed)
	if n < 3 || n > 500 {
		return "", ErrCancelReasonInvalid
	}
	return trimmed, nil
}

// CancelAction otkazuje aktivnu akciju.
// Redoslijed: lock Akcija → authorize → already-cancelled → already-completed
// → cancel pending signups → revoke invites → update cancellation polja.
// Ne mijenja Prijava, Platio, Transakcija, statistike ni ActionParticipationRequest.
// Ne šalje notifikacije.
//
// authorize se poziva unutar TX nad zaključanom akcijom; vrati ErrCancelUnauthorized ako nema prava.
func CancelAction(
	db *gorm.DB,
	actionID uint,
	reason string,
	authorize func(tx *gorm.DB, locked *models.Akcija) error,
) (*models.Akcija, error) {
	trimmed, err := NormalizeCancelReason(reason)
	if err != nil {
		return nil, err
	}

	var out models.Akcija
	err = db.Transaction(func(tx *gorm.DB) error {
		locked, err := helpers.LockAkcijaForUpdate(tx, actionID)
		if err != nil {
			return err
		}

		if authorize != nil {
			if err := authorize(tx, locked); err != nil {
				return err
			}
		}

		if locked.IsCancelled {
			return helpers.ErrAkcijaAlreadyCancelled
		}
		if locked.IsCompleted {
			return helpers.ErrAkcijaAlreadyComplete
		}

		cancelledAt := time.Now()

		if _, err := helpers.CancelPendingSignupRequestsForActionTx(tx, locked.ID, cancelledAt); err != nil {
			return err
		}
		if _, err := helpers.RevokeActiveActionInviteLinksTx(tx, locked.ID, cancelledAt); err != nil {
			return err
		}

		if err := tx.Model(&models.Akcija{}).Where("id = ?", locked.ID).Updates(map[string]any{
			"is_cancelled":        true,
			"cancelled_at":        cancelledAt,
			"cancellation_reason": trimmed,
		}).Error; err != nil {
			return err
		}

		if err := tx.First(&out, locked.ID).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}
