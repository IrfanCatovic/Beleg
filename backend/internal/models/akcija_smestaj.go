package models

type AkcijaSmestaj struct {
	ID                uint    `gorm:"primaryKey" json:"id"`
	AkcijaID          uint    `gorm:"index;not null" json:"akcijaId"`
	Naziv             string  `gorm:"type:varchar(200);not null" json:"naziv"`
	CenaPoOsobiUkupno float64 `gorm:"default:0" json:"cenaPoOsobiUkupno"`
	Opis              string  `gorm:"type:text" json:"opis,omitempty"`
}

func (AkcijaSmestaj) TableName() string {
	return "akcija_smestaj"
}
