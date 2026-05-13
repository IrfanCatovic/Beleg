package models

import (
	"encoding/json"
	"time"
)

// Ferrata stalni katalog via ferrata destinacija.
type Ferrata struct {
	ID                  uint            `gorm:"primaryKey" json:"id"`
	Naziv               string          `gorm:"type:varchar(255);not null" json:"naziv"`
	Slug                string          `gorm:"type:varchar(255);uniqueIndex;not null" json:"slug"`
	Drzava              string          `gorm:"column:drzava;type:varchar(120)" json:"drzava"`
	GradOpstina         string          `gorm:"column:grad_opstina;type:varchar(120)" json:"gradOpstina"`
	Lokacija            string          `gorm:"type:varchar(400)" json:"lokacija"`
	KratakOpis          string          `gorm:"column:kratak_opis;type:text" json:"kratakOpis,omitempty"`
	Opis                string          `gorm:"type:text" json:"opis"`
	Tezina              string          `gorm:"type:varchar(40)" json:"tezina"`
	TezinaOpcija        string          `gorm:"column:tezina_opcija;type:varchar(40)" json:"tezinaOpcija"`
	DuzinaM             int             `gorm:"column:duzina_m" json:"duzinaM"`
	VisinskaRazlikaM    int             `gorm:"column:visinska_razlika_m" json:"visinskaRazlikaM"`
	PrilazMin           int             `gorm:"column:prilaz_min" json:"prilazMin"`
	TrajanjeMin         int             `gorm:"column:trajanje_min" json:"trajanjeMin"`
	TrajanjeMax         int             `gorm:"column:trajanje_max" json:"trajanjeMax"`
	PogodnoZaPocetnike  string          `gorm:"column:pogodno_za_pocetnike;type:varchar(80)" json:"pogodnoZaPocetnike"`
	ParkingInfo         string          `gorm:"column:parking_info;type:varchar(500)" json:"parkingInfo"`
	PovratakInfo        string          `gorm:"column:povratak_info;type:varchar(500)" json:"povratakInfo"`
	NajboljeVremeInfo   string          `gorm:"column:najbolje_vreme_info;type:varchar(500)" json:"najboljeVremeInfo"`
	QuickTip            string          `gorm:"column:quick_tip;type:varchar(600)" json:"quickTip"`
	WhoBeginnersText    string          `gorm:"column:who_beginners_text;type:varchar(200)" json:"whoBeginnersText"`
	WhoRecreationalText string          `gorm:"column:who_recreational_text;type:varchar(200)" json:"whoRecreationalText"`
	WhoExperiencedText  string          `gorm:"column:who_experienced_text;type:varchar(200)" json:"whoExperiencedText"`
	Lat                 *float64        `gorm:"column:lat" json:"lat"` // glavna tačka ferate; kasnije uporediti sa guide_profiles.base_lat/lng
	Lng                 *float64        `gorm:"column:lng" json:"lng"`
	ParkingLat          *float64        `gorm:"column:parking_lat" json:"parkingLat"`
	ParkingLng          *float64        `gorm:"column:parking_lng" json:"parkingLng"`
	MapNote             string          `gorm:"column:map_note;type:varchar(800)" json:"mapNote"`
	ObaveznaOpremaJSON  json.RawMessage `gorm:"column:obavezna_oprema_json;type:jsonb" json:"-"`
	OkolinaJSON         json.RawMessage `gorm:"column:okolina_json;type:jsonb" json:"-"`
	SmestajJSON         json.RawMessage `gorm:"column:smestaj_json;type:jsonb" json:"-"`
	HighlightsJSON      json.RawMessage `gorm:"column:highlights_json;type:jsonb" json:"-"`
	CoverImage          string          `gorm:"column:cover_image;type:varchar(800)" json:"coverImage"`
	Status              string          `gorm:"type:varchar(20);default:'active';index" json:"status"`
	CreatedAt           time.Time       `json:"createdAt"`
	UpdatedAt           time.Time       `json:"updatedAt"`
}

func (Ferrata) TableName() string {
	return "ferratas"
}
