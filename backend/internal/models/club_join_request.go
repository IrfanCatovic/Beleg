package models

import "time"

const (
	ClubJoinRequestPending   = "pending"
	ClubJoinRequestCancelled = "cancelled"
	ClubJoinRequestRejected  = "rejected"
	ClubJoinRequestAccepted  = "accepted"
	ClubJoinRequestBlocked   = "blocked"
)

type ClubJoinRequest struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	ClubID    uint      `gorm:"index;not null" json:"clubId"`
	Status    string    `gorm:"type:varchar(20);index;not null;default:'pending'" json:"status"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (ClubJoinRequest) TableName() string {
	return "club_join_requests"
}

type ClubJoinBlock struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	ClubID    uint      `gorm:"index;not null" json:"clubId"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (ClubJoinBlock) TableName() string {
	return "club_join_blocks"
}
