package models

import "time"

// PushToken čuva Expo push token za mobilni uređaj korisnika.
type PushToken struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	Token     string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"token"`
	Platform  string    `gorm:"type:varchar(10)" json:"platform,omitempty"` // android | ios
	AppKind   string    `gorm:"type:varchar(16)" json:"appKind,omitempty"`  // expo | standalone
	UpdatedAt time.Time `json:"updatedAt"`
}

func (PushToken) TableName() string {
	return "push_tokens"
}
