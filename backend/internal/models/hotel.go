package models

import "time"

// Hotel — smeštaj u katalogu (lat/lng za kasnije „u okolini“); slug se generiše na serveru.
type Hotel struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Naziv     string    `gorm:"type:varchar(255);not null" json:"naziv"`
	Slug      string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"slug"`
	Lat       float64   `gorm:"column:lat;not null" json:"lat"`
	Lng       float64   `gorm:"column:lng;not null" json:"lng"`
	Opis      string    `gorm:"type:text" json:"opis,omitempty"`
	Adresa    string    `gorm:"type:varchar(400)" json:"adresa,omitempty"`
	Telefon   string    `gorm:"type:varchar(80)" json:"telefon,omitempty"`
	Status    string    `gorm:"type:varchar(20);default:'active';index" json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (Hotel) TableName() string {
	return "hotels"
}
