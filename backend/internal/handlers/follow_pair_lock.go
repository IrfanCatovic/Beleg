package handlers

import (
	"errors"

	"beleg-app/backend/internal/models"

	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	errFollowBlocked    = errors.New("follow blocked")
	errFollowSelf       = errors.New("follow self")
	errUserPairNotFound = errors.New("user pair not found")
	errUserPairDeleted  = errors.New("user deleted")
)

func sortedUserPairIDs(a, b uint) (uint, uint) {
	if a < b {
		return a, b
	}
	return b, a
}

// lockUserPair zaključava oba korisnika u stabilnom redoslijedu (manji ID prvi).
func lockUserPair(tx *gorm.DB, userIDA, userIDB uint) error {
	if userIDA == 0 || userIDB == 0 {
		return errUserPairNotFound
	}
	if userIDA == userIDB {
		return errFollowSelf
	}
	lo, hi := sortedUserPairIDs(userIDA, userIDB)
	var users []models.Korisnik
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id IN ?", []uint{lo, hi}).
		Order("id ASC").
		Find(&users).Error; err != nil {
		return err
	}
	if len(users) != 2 {
		return errUserPairNotFound
	}
	for _, u := range users {
		if u.Role == "deleted" {
			return errUserPairDeleted
		}
	}
	return nil
}

func isBlockedEitherDirectionTx(tx *gorm.DB, a, b uint) bool {
	if a == 0 || b == 0 {
		return false
	}
	var cnt int64
	_ = tx.Model(&models.Block{}).
		Where("(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", a, b, b, a).
		Count(&cnt).Error
	return cnt > 0
}

func deleteFollowsBetweenUsers(tx *gorm.DB, a, b uint) error {
	return tx.Where("(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)", a, b, b, a).
		Delete(&models.Follow{}).Error
}

func isDuplicateUsernameDBError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") && strings.Contains(msg, "username")
}

func isDeadlockError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "deadlock") || strings.Contains(msg, "database table is locked")
}
