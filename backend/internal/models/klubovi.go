package models

import "time"

type Klubovi struct {
	ID                         uint      `gorm:"primaryKey" json:"id"`
	Naziv                      string    `gorm:"type:varchar(255)" json:"naziv"`
	Adresa                     string    `gorm:"type:varchar(255)" json:"adresa,omitempty"`
	Telefon                    string    `gorm:"type:varchar(50)" json:"telefon,omitempty"`
	Email                      string    `gorm:"type:varchar(255)" json:"email,omitempty"`

	//limitirati broj admina i clanova
	KorisnikAdminLimit          int       `gorm:"default:3" json:"korisnik_admin_limit"`
	KorisnikLimit               int       `gorm:"default:100" json:"korisnik_limit"`
	MaxStorageGB 				float64    `gorm:"default:10.0" json:"max_storage_gb"`	

	CreatedAt                  time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt                  time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	
}

func (Klubovi) TableName() string {
	return "klubovi"
}
