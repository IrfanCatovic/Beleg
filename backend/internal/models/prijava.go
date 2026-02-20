package models

import "time"

type Prijava struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	AkcijaID     uint      `gorm:"index" json:"akcijaId"` //akcija id i korisnk username se vezu tipa na jendu akciju moze biti vise prijava
	Korisnik     string    `json:"korisnik"`
	Status       string    `gorm:"default:'prijavljen'" json:"status"`
	PrijavljenAt time.Time `gorm:"autoCreateTime" json:"prijavljenAt"`
}

func (Prijava) TableName() string {
	return "prijave"
}
