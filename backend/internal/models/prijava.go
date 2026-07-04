package models

import "time"

type Prijava struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	AkcijaID     uint      `gorm:"uniqueIndex:idx_prijave_akcija_korisnik;not null" json:"akcijaId"`
	KorisnikID   uint      `gorm:"uniqueIndex:idx_prijave_akcija_korisnik;not null" json:"korisnikId"`
	Status       string    `gorm:"default:'prijavljen'" json:"status"`
	Platio       bool      `gorm:"default:false" json:"platio"`
	PrijavljenAt time.Time `gorm:"autoCreateTime" json:"prijavljenAt"`

	// Relacije za GORM Preload
	Akcija   Akcija   `gorm:"foreignKey:AkcijaID"`
	Korisnik Korisnik `gorm:"foreignKey:KorisnikID"`
}

func (Prijava) TableName() string {
	return "prijave"
}
