package models

type AkcijaPrevoz struct {
	ID          uint    `gorm:"primaryKey" json:"id"`
	AkcijaID    uint    `gorm:"index;not null" json:"akcijaId"`
	TipPrevoza  string  `gorm:"type:varchar(80);not null" json:"tipPrevoza"`
	NazivGrupe  string  `gorm:"type:varchar(120);not null" json:"nazivGrupe"`
	Kapacitet   int     `gorm:"default:0" json:"kapacitet"`
	CenaPoOsobi float64 `gorm:"default:0" json:"cenaPoOsobi"`
}

func (AkcijaPrevoz) TableName() string {
	return "akcija_prevoz"
}
