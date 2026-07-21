package actions

import (
	"errors"
	"strings"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"gorm.io/gorm"
)

type BulkMemberUserResult struct {
	KorisnikID uint   `json:"korisnikId"`
	Status     string `json:"status"`
	Reason     string `json:"reason,omitempty"`
}

type BulkAddMembersResult struct {
	Added         int
	Updated       int
	Skipped       int
	Results       []BulkMemberUserResult
	Processed     int
	NewlySummited int
}

func UniqueKorisnikIDs(ids []uint) []uint {
	uniqueIDs := make([]uint, 0, len(ids))
	seen := make(map[uint]struct{}, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniqueIDs = append(uniqueIDs, id)
	}
	return uniqueIDs
}

// BulkAddMembersToCompletedAction dodaje više članova na završenu akciju u jednoj transakciji.
// Completed-action add/bulk ne koristi maxLjudi kao signup kapacitet.
func BulkAddMembersToCompletedAction(db *gorm.DB, akcija *models.Akcija, korisnikIDs []uint) (*BulkAddMembersResult, error) {
	if akcija == nil || akcija.ID == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	isGuideAction := strings.TrimSpace(strings.ToLower(akcija.OrganizatorTip)) == "vodic"
	if !isGuideAction && akcija.KlubID == nil {
		return nil, errors.New("Akcija nema domaći klub")
	}

	res := &BulkAddMembersResult{Processed: len(korisnikIDs)}
	newlySummitedUserIDs := make([]uint, 0, len(korisnikIDs))
	seenInPayload := make(map[uint]struct{}, len(korisnikIDs))

	memberOpts := completedMemberApplyOpts{
		requireClubMember: !isGuideAction,
		setPlatio:         true,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		lockedAkcija, err := lockCompletedAkcijaTx(tx, akcija.ID)
		if err != nil {
			return err
		}

		for _, korisnikID := range korisnikIDs {
			if korisnikID == 0 {
				res.Skipped++
				res.Results = append(res.Results, BulkMemberUserResult{
					KorisnikID: korisnikID,
					Status:     "skipped",
					Reason:     "nevažeći korisnikId",
				})
				continue
			}
			if _, dup := seenInPayload[korisnikID]; dup {
				res.Skipped++
				res.Results = append(res.Results, BulkMemberUserResult{
					KorisnikID: korisnikID,
					Status:     "skipped",
					Reason:     "duplikat u listi",
				})
				continue
			}
			seenInPayload[korisnikID] = struct{}{}

			result, err := applyCompletedActionMemberTx(tx, &lockedAkcija, korisnikID, memberOpts)
			if err != nil {
				return err
			}

			switch result.outcome {
			case "added":
				res.Added++
				res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "added"})
			case "updated":
				res.Updated++
				res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "updated"})
			case "skipped":
				res.Skipped++
				res.Results = append(res.Results, BulkMemberUserResult{
					KorisnikID: korisnikID,
					Status:     "skipped",
					Reason:     result.reason,
				})
			}
			if result.shouldNotify {
				newlySummitedUserIDs = append(newlySummitedUserIDs, korisnikID)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	for _, userID := range newlySummitedUserIDs {
		notifications.NotifySummitReward(db, userID, *akcija)
	}
	res.NewlySummited = len(newlySummitedUserIDs)
	return res, nil
}
