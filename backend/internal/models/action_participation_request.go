package models

import "time"

const (
	ActionParticipationRequestPending   = "pending"
	ActionParticipationRequestAccepted  = "accepted"
	ActionParticipationRequestRejected  = "rejected"
	ActionParticipationRequestCancelled = "cancelled"
)

type ActionParticipationRequest struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	AkcijaID      uint       `gorm:"index;not null" json:"akcijaId"`
	TargetUserID  uint       `gorm:"index;not null" json:"targetUserId"`
	RequestedByID uint       `gorm:"index;not null" json:"requestedById"`
	Status        string     `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	RespondedAt   *time.Time `json:"respondedAt,omitempty"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`

	Akcija      Akcija   `gorm:"foreignKey:AkcijaID" json:"-"`
	TargetUser  Korisnik `gorm:"foreignKey:TargetUserID" json:"-"`
	RequestedBy Korisnik `gorm:"foreignKey:RequestedByID" json:"-"`
}

func (ActionParticipationRequest) TableName() string {
	return "action_participation_requests"
}
