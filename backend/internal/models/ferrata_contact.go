package models

import "time"

type FerrataContact struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	FerrataID  uint      `gorm:"column:ferrata_id;index;not null" json:"ferrataId"`
	Ime        string    `gorm:"type:varchar(200);not null" json:"ime"`
	Telefon    string    `gorm:"type:varchar(40)" json:"telefon,omitempty"`
	Whatsapp   string    `gorm:"type:varchar(40)" json:"whatsapp,omitempty"`
	Email      string    `gorm:"type:varchar(255)" json:"email,omitempty"`
	Napomena   string    `gorm:"type:text" json:"napomena,omitempty"`
	Aktivan    bool      `gorm:"default:true" json:"aktivan"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (FerrataContact) TableName() string {
	return "ferrata_contacts"
}
