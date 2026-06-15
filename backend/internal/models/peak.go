package models

import "time"

// Peak — katalog vrhova; slug se generiše na serveru. Lat/Lng su opcioni (na mapi se prikazuju samo vrhovi sa koordinatama).
type Peak struct {
	ID        uint     `gorm:"primaryKey" json:"id"`
	NazivVrha string   `gorm:"column:naziv_vrha;type:varchar(255);not null" json:"naziv"`
	Planina   string   `gorm:"column:planina;type:varchar(255)" json:"planina"`
	Slug      string   `gorm:"column:slug;type:varchar(255);uniqueIndex;not null" json:"slug"`
	Status    string   `gorm:"column:status;type:varchar(20);default:'active';index" json:"status"`
	VisinaM   int      `gorm:"column:visina_m" json:"visinaM"`
	Lat       *float64 `gorm:"column:lat" json:"lat"`
	Lng       *float64 `gorm:"column:lng" json:"lng"`
	Drzava    string   `gorm:"column:drzava;type:varchar(120)" json:"drzava"`
	Grad      string   `gorm:"column:grad;type:varchar(120)" json:"grad"`
	Opis      string   `gorm:"column:opis;type:text" json:"opis,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (Peak) TableName() string {
	return "peaks"
}
