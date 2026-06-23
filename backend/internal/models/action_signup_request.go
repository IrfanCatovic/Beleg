package models

import "time"

const (
	ActionSignupRequestPending   = "pending"
	ActionSignupRequestAccepted  = "accepted"
	ActionSignupRequestRejected  = "rejected"
	ActionSignupRequestCancelled = "cancelled"
)

type ActionSignupRequest struct {
	ID                   uint       `gorm:"primaryKey" json:"id"`
	AkcijaID             uint       `gorm:"index;not null" json:"akcijaId"`
	RequesterID          uint       `gorm:"index;not null" json:"requesterId"`
	Status               string     `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	SelectedSmestajIDs   string     `gorm:"type:text" json:"-"`
	SelectedPrevozIDs    string     `gorm:"type:text" json:"-"`
	SelectedRentItemsRaw string     `gorm:"type:text" json:"-"`
	ReviewedByID         *uint      `gorm:"index" json:"reviewedById,omitempty"`
	RespondedAt          *time.Time `json:"respondedAt,omitempty"`
	CreatedAt            time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt            time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`

	Akcija      Akcija   `gorm:"foreignKey:AkcijaID" json:"-"`
	Requester   Korisnik `gorm:"foreignKey:RequesterID" json:"-"`
	ReviewedBy  *Korisnik `gorm:"foreignKey:ReviewedByID" json:"-"`
}

func (ActionSignupRequest) TableName() string {
	return "action_signup_requests"
}
