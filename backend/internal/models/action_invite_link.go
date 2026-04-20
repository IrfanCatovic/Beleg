package models

import "time"

type ActionInviteLink struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	AkcijaID  uint       `gorm:"index;not null" json:"akcijaId"`
	TokenHash string     `gorm:"type:char(64);uniqueIndex;not null" json:"-"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	RevokedAt *time.Time `json:"revokedAt,omitempty"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (ActionInviteLink) TableName() string {
	return "action_invite_links"
}
