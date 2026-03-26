package models

import "time"

// Block predstavlja jednosmernu blokadu: blocker_id blokira blocked_id.
type Block struct {
	ID uint `gorm:"primaryKey" json:"id"`

	BlockerID uint `gorm:"column:blocker_id;not null;index:idx_blocks_blocker,priority:1;uniqueIndex:uq_blocks_blocker_blocked,priority:1;check:blocker_id <> blocked_id" json:"blockerId"`
	BlockedID uint `gorm:"column:blocked_id;not null;index:idx_blocks_blocked,priority:1;uniqueIndex:uq_blocks_blocker_blocked,priority:2;check:blocker_id <> blocked_id" json:"blockedId"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (Block) TableName() string {
	return "blocks"
}

