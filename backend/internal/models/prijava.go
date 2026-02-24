package models

import "time"

type Prijava struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	AkcijaID     uint      `gorm:"index" json:"akcijaId"`
	KorisnikID   uint      `gorm:"index" json:"korisnikId"`
	Status       string    `gorm:"default:'prijavljen'" json:"status"`
	PrijavljenAt time.Time `gorm:"autoCreateTime" json:"prijavljenAt"`

	// Relacije za GORM Preload
	Akcija   Akcija   `gorm:"foreignKey:AkcijaID"`
	Korisnik Korisnik `gorm:"foreignKey:KorisnikID"`
}

func (Prijava) TableName() string {
	return "prijave"
}
