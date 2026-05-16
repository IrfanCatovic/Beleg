package models

import (
	"encoding/json"
	"time"
)

const (
	GuideStatusPending   = "pending"
	GuideStatusApproved  = "approved"
	GuideStatusRejected  = "rejected"
	GuideStatusSuspended = "suspended"
)

// GuideProfile profesionalni vodički profil (1:1 sa Korisnik).
type GuideProfile struct {
	ID               uint            `gorm:"primaryKey" json:"id"`
	KorisnikID       uint            `gorm:"column:korisnik_id;uniqueIndex;not null" json:"korisnikId"`
	Status           string          `gorm:"type:varchar(20);default:'pending';index" json:"status"`
	Naslov           string          `gorm:"type:varchar(300);not null" json:"naslov"`
	Opis             string          `gorm:"type:text;not null" json:"opis"`
	Drzava           string          `gorm:"type:varchar(120)" json:"drzava"`
	Region           string          `gorm:"type:varchar(120)" json:"region"`
	Grad             string          `gorm:"type:varchar(120)" json:"grad"`
	BaseLat          *float64        `gorm:"column:base_lat" json:"baseLat,omitempty"`
	BaseLng          *float64        `gorm:"column:base_lng" json:"baseLng,omitempty"`
	GodineIskustva   int             `gorm:"column:godine_iskustva;default:0" json:"godineIskustva"`
	JeziciJSON       json.RawMessage `gorm:"column:jezici_json;type:jsonb" json:"-"`
	SertifikatiOpis  string          `gorm:"column:sertifikati_opis;type:text" json:"sertifikatiOpis,omitempty"`
	ProsecnaOcena    float64         `gorm:"column:prosecna_ocena;default:0" json:"prosecnaOcena"`
	BrojOcena        int             `gorm:"column:broj_ocena;default:0" json:"brojOcena"`
	BrojVodjenihTura int             `gorm:"column:broj_vodjenih_tura;default:0" json:"brojVodjenihTura"`
	AdminNapomena   string          `gorm:"column:admin_napomena;type:text" json:"adminNapomena,omitempty"`
	RazlogOdbijanja  string          `gorm:"column:razlog_odbijanja;type:text" json:"razlogOdbijanja,omitempty"`
	ApprovedBy       *uint           `gorm:"column:approved_by" json:"approvedBy,omitempty"`
	ApprovedAt       *time.Time      `gorm:"column:approved_at" json:"approvedAt,omitempty"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`

	Korisnik       Korisnik         `gorm:"foreignKey:KorisnikID" json:"-"`
	GuideTourTypes []GuideTourType  `gorm:"foreignKey:GuideProfileID" json:"-"`
}

func (GuideProfile) TableName() string {
	return "guide_profiles"
}
