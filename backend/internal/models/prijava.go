package models

import "time"

type Prijava struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	AkcijaID     uint      `gorm:"index" json:"akcijaId"` // veza sa akcijom
	Korisnik     string    `json:"korisnik"`              // username za sada
	PrijavljenAt time.Time `gorm:"autoCreateTime" json:"prijavljenAt"`
}
