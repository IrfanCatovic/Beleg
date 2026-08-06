package handlers

import (
	"errors"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// errActionSignupBlocked: applicant ↔ creator/guide block zabranjuje novu prijavu (403).
var errActionSignupBlocked = errors.New("Nije moguće prijaviti se zbog blokade")

// isBlockedFromActionSignupTx: block u bilo kojem smjeru između applicant-a i
// action creator (AddedByID) i/ili assigned guide (VodicID). Isti korisnik se
// provjerava jednom. Superadmin nije izuzet.
func isBlockedFromActionSignupTx(tx *gorm.DB, applicantID uint, akcija *models.Akcija) bool {
	if tx == nil || akcija == nil || applicantID == 0 {
		return false
	}
	seen := make(map[uint]struct{}, 2)
	checkPeer := func(peerID uint) bool {
		if peerID == 0 || peerID == applicantID {
			return false
		}
		if _, ok := seen[peerID]; ok {
			return false
		}
		seen[peerID] = struct{}{}
		return isBlockedEitherDirectionTx(tx, applicantID, peerID)
	}
	if checkPeer(akcija.AddedByID) {
		return true
	}
	if checkPeer(akcija.VodicID) {
		return true
	}
	return false
}
