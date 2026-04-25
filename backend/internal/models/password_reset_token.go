package models

import "time"

type PasswordResetToken struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"index;not null" json:"userId"`
	TokenHash string     `gorm:"type:char(64);uniqueIndex;not null" json:"-"`
	ExpiresAt time.Time  `gorm:"index;not null" json:"expiresAt"`
	UsedAt    *time.Time `json:"usedAt,omitempty"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"createdAt"`
}

func (PasswordResetToken) TableName() string {
	return "password_reset_tokens"
}
