package models

import "time"

type Akcija struct {
	ID                       uint      `gorm:"primaryKey" json:"id"`
	Naziv                    string    `json:"naziv"`
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
	VodicID                  uint      `gorm:"default:0" json:"vodicId"`           // ID korisnika (vodiča) koji vodi akciju
	DrugiVodicIme            string    `gorm:"type:varchar(200)" json:"drugiVodicIme,omitempty"` // Ime drugog vodiča (slobodan unos)
}

// TableName specifies the table name for the Akcija model
func (Akcija) TableName() string {
	return "akcije"
}
