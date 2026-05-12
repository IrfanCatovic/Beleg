package models

import (
	"encoding/json"
	"time"
)

// Ferrata stalni katalog via ferrata destinacija.
type Ferrata struct {
	ID                   uint            `gorm:"primaryKey" json:"id"`
	Naziv                string          `gorm:"type:varchar(255);not null" json:"naziv"`
	Slug                 string          `gorm:"type:varchar(255);uniqueIndex;not null" json:"slug"`
	Drzava               string          `gorm:"column:drzava;type:varchar(120)" json:"drzava"`
	GradOpstina          string          `gorm:"column:grad_opstina;type:varchar(120)" json:"gradOpstina"`
	Lokacija             string          `gorm:"type:varchar(400)" json:"lokacija"`
	KratakOpis           string          `gorm:"column:kratak_opis;type:text" json:"kratakOpis,omitempty"`
	Opis                 string          `gorm:"type:text" json:"opis"`
	Tezina               string          `gorm:"type:varchar(40)" json:"tezina"`
	TezinaOpcija         string          `gorm:"column:tezina_opcija;type:varchar(40)" json:"tezinaOpcija"`
	DuzinaM              int             `gorm:"column:duzina_m" json:"duzinaM"`
	VisinskaRazlikaM     int             `gorm:"column:visinska_razlika_m" json:"visinskaRazlikaM"`
	PrilazMin            int             `gorm:"column:prilaz_min" json:"prilazMin"`
	TrajanjeMin          int             `gorm:"column:trajanje_min" json:"trajanjeMin"`
	TrajanjeMax          int             `gorm:"column:trajanje_max" json:"trajanjeMax"`
	PogodnoZaPocetnike   string          `gorm:"column:pogodno_za_pocetnike;type:varchar(80)" json:"pogodnoZaPocetnike"`
	ObaveznaOpremaJSON   json.RawMessage `gorm:"column:obavezna_oprema_json;type:jsonb" json:"-"`
	HighlightsJSON       json.RawMessage `gorm:"column:highlights_json;type:jsonb" json:"-"`
	CoverImage           string          `gorm:"column:cover_image;type:varchar(800)" json:"coverImage"`
	Status               string          `gorm:"type:varchar(20);default:'active';index" json:"status"`
	CreatedAt            time.Time       `json:"createdAt"`
	UpdatedAt            time.Time       `json:"updatedAt"`
}

func (Ferrata) TableName() string {
	return "ferratas"
}
