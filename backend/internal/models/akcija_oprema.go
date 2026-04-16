package models

type AkcijaOprema struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	AkcijaID uint   `gorm:"index;not null" json:"akcijaId"`
	Naziv    string `gorm:"type:varchar(200);not null" json:"naziv"`
	Obavezna bool   `gorm:"default:true" json:"obavezna"`
}

func (AkcijaOprema) TableName() string {
	return "akcija_oprema"
}
