package actions

import (
	"errors"
	"sort"
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

// CancelActionResult je ishod uspješnog otkazivanja.
// RecipientUserIDs su snimljeni u TX prije signup cleanup-a; ne idu u HTTP response.
type CancelActionResult struct {
	Akcija           *models.Akcija
	RecipientUserIDs []uint
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

// MergeCancelRecipientIDs spaja učesnike i pending requestore, uklanja actor/0, sortira.
func MergeCancelRecipientIDs(participantIDs, requesterIDs []uint, actorID uint) []uint {
	seen := make(map[uint]struct{}, len(participantIDs)+len(requesterIDs))
	for _, id := range participantIDs {
		if id == 0 || id == actorID {
			continue
		}
		seen[id] = struct{}{}
	}
	for _, id := range requesterIDs {
		if id == 0 || id == actorID {
			continue
		}
		seen[id] = struct{}{}
	}
	out := make([]uint, 0, len(seen))
	for id := range seen {
		out = append(out, id)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// CollectCancelRecipientIDs snima primaoce dok je akcija još locked i prije pending→cancelled.
func CollectCancelRecipientIDs(tx *gorm.DB, actionID, actorID uint) ([]uint, error) {
	var participantIDs []uint
	if err := tx.Model(&models.Prijava{}).
		Where("akcija_id = ? AND status IN ?", actionID, helpers.PrijavaActiveStatuses).
		Distinct("korisnik_id").
		Pluck("korisnik_id", &participantIDs).Error; err != nil {
		return nil, err
	}

	var requesterIDs []uint
	if err := tx.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND status = ?", actionID, models.ActionSignupRequestPending).
		Distinct("requester_id").
		Pluck("requester_id", &requesterIDs).Error; err != nil {
		return nil, err
	}

	return MergeCancelRecipientIDs(participantIDs, requesterIDs, actorID), nil
}

// CancelAction otkazuje aktivnu akciju.
// Redoslijed: lock Akcija → authorize → already-cancelled → already-completed
// → recipient snapshot → cancel pending signups → revoke invites → update cancellation polja.
// Ne mijenja Prijava, Platio, Transakcija, statistike ni ActionParticipationRequest.
// Notifikacije se šalju van TX nakon uspješnog commita (handler).
//
// authorize se poziva unutar TX nad zaključanom akcijom; vrati ErrCancelUnauthorized ako nema prava.
func CancelAction(
	db *gorm.DB,
	actionID uint,
	reason string,
	actorID uint,
	authorize func(tx *gorm.DB, locked *models.Akcija) error,
) (*CancelActionResult, error) {
	trimmed, err := NormalizeCancelReason(reason)
	if err != nil {
		return nil, err
	}

	var out models.Akcija
	var recipients []uint
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

		// Snapshot prije pending→cancelled — poslije cleanup-a se ne može pouzdano razlikovati.
		ids, err := CollectCancelRecipientIDs(tx, locked.ID, actorID)
		if err != nil {
			return err
		}
		recipients = ids

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
	return &CancelActionResult{
		Akcija:           &out,
		RecipientUserIDs: recipients,
	}, nil
}
