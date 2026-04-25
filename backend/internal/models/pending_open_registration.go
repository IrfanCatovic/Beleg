package models

import "time"

// PendingOpenRegistration čeka potvrdu emaila pre kreiranja reda u korisnici (open registracija bez kluba).
type PendingOpenRegistration struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	Username      string     `gorm:"size:30;not null;index" json:"username"`
	PasswordHash  string     `gorm:"not null" json:"-"`
	Email         string     `gorm:"size:255;not null;index" json:"email"`
	FullName      string     `gorm:"size:100" json:"fullName,omitempty"`
	Pol           string     `gorm:"type:varchar(20)" json:"pol,omitempty"`
	DatumRodjenja *time.Time `json:"datum_rodjenja,omitempty"`
	TokenHash     string     `gorm:"type:char(64);not null;index" json:"-"`
	ExpiresAt     time.Time  `gorm:"not null;index" json:"expiresAt"`
	UsedAt        *time.Time `json:"usedAt,omitempty"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (PendingOpenRegistration) TableName() string {
	return "pending_open_registrations"
}
