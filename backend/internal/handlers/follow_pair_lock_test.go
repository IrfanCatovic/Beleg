package handlers

import (
	"testing"

	"gorm.io/gorm"
)

func TestLockUserPair_SortedOrder(t *testing.T) {
	db := testFollowBlockDB(t)
	a := seedFollowUser(t, db, "lock_a")
	b := seedFollowUser(t, db, "lock_b")
	lo, hi := sortedUserPairIDs(a.ID, b.ID)
	if lo >= hi {
		t.Fatalf("sorted pair must be lo < hi, got %d %d", lo, hi)
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		return lockUserPair(tx, b.ID, a.ID)
	}); err != nil {
		t.Fatalf("lockUserPair failed: %v", err)
	}
}
