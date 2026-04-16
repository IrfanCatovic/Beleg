package models

type AkcijaOpremaRent struct {
	ID               uint    `gorm:"primaryKey" json:"id"`
	AkcijaID         uint    `gorm:"index;not null" json:"akcijaId"`
	AkcijaOpremaID   *uint   `gorm:"index" json:"akcijaOpremaId,omitempty"`
	NazivOpreme      string  `gorm:"type:varchar(200);not null" json:"nazivOpreme"`
	DostupnaKolicina int     `gorm:"default:0" json:"dostupnaKolicina"`
	CenaPoSetu       float64 `gorm:"default:0" json:"cenaPoSetu"`
}

func (AkcijaOpremaRent) TableName() string {
	return "akcija_oprema_rent"
}
