package models

import "time"

const (
	FollowStatusPending  = "pending"
	FollowStatusAccepted = "accepted"
)

// Follow predstavlja zahtev za praćenje i (nakon prihvatanja) aktivno praćenje.
// requester_id -> target_id
type Follow struct {
	ID uint `gorm:"primaryKey" json:"id"`

	RequesterID uint `gorm:"column:requester_id;not null;index:idx_follows_requester_status,priority:1;uniqueIndex:uq_follows_requester_target,priority:1;check:requester_id <> target_id" json:"requesterId"`
	TargetID    uint `gorm:"column:target_id;not null;index:idx_follows_target_status,priority:1;uniqueIndex:uq_follows_requester_target,priority:2;check:requester_id <> target_id" json:"targetId"`

	Status string `gorm:"type:varchar(16);not null;index:idx_follows_requester_status,priority:2;index:idx_follows_target_status,priority:2;check:status IN ('pending','accepted')" json:"status"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Follow) TableName() string {
	return "follows"
}

