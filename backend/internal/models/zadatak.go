package models

import "time"


type Zadatak struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Naziv        string     `gorm:"type:varchar(255);not null" json:"naziv"`
	Opis         string     `gorm:"type:text" json:"opis"`
	AllowedRoles []string   `gorm:"serializer:json;type:text" json:"allowedRoles"` 
	AllowAll     bool       `gorm:"default:false" json:"allowAll"`                  
	Deadline     *time.Time `json:"deadline,omitempty"`
	Hitno        bool       `gorm:"default:false" json:"hitno"`
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`

	ZadatakKorisnici []ZadatakKorisnik `gorm:"foreignKey:ZadatakID" json:"-"`
}


func (Zadatak) TableName() string {
	return "zadaci"
}


type ZadatakKorisnik struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ZadatakID  uint      `gorm:"index;not null" json:"zadatakId"`
	KorisnikID uint      `gorm:"index;not null" json:"korisnikId"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"createdAt"`

	Zadatak  Zadatak  `gorm:"foreignKey:ZadatakID"`
	Korisnik Korisnik `gorm:"foreignKey:KorisnikID"`
}

func (ZadatakKorisnik) TableName() string {
	return "zadatak_korisnici"
}
