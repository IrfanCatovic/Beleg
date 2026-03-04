package models

import "time"

type Akcija struct {
	ID                       uint      `gorm:"primaryKey" json:"id"`
	Naziv                    string    `json:"naziv"`
	Planina                  string    `json:"planina"` // Ime planine
	Vrh                      string    `json:"vrh"`
	Datum                    time.Time `json:"datum"`
	Opis                     string    `json:"opis,omitempty"`
	Tezina                   string    `json:"tezina,omitempty"`
	CreatedAt                time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt                time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	SlikaURL                 string    `json:"slikaUrl,omitempty"`
	IsCompleted              bool      `gorm:"default:false" json:"isCompleted"`
	UkupnoMetaraUsponaAkcija int       `json:"kumulativniUsponM"`
	UkupnoKmAkcija           float64   `json:"duzinaStazeKm"`
	VisinaVrhM               int       `json:"visinaVrhM"`                     // Visina vrha u metrima
	ZimskiUspon              bool      `gorm:"default:false" json:"zimskiUspon"` // Da li je akcija zimski uspon
	VodicID                  uint      `gorm:"default:0" json:"vodicId"`           // ID korisnika (vodiča) koji vodi akciju
	DrugiVodicIme            string    `gorm:"type:varchar(200)" json:"drugiVodicIme,omitempty"` // Ime drugog vodiča (slobodan unos)
	AddedByID                uint      `gorm:"default:0" json:"addedById"` // ID korisnika koji je dodao akciju
	// false = samo na profilu člana, ne u listi akcija kluba
	UIstorijiKluba           bool      `gorm:"column:u_istoriji_kluba;not null;default:true" json:"uIstorijiKluba"`
}

// TableName specifies the table name for the Akcija model
func (Akcija) TableName() string {
	return "akcije"
}
