package models

import "time"

// Tipovi obaveštenja za prikaz i filtriranje.
const (
	ObavestenjeTipUplata                     = "uplata"       // nova uplata → blagajnik + admin
	ObavestenjeTipAkcija                     = "akcija"       // nova akcija → članovi kluba; ako je javna → svi sa klub_id
	ObavestenjeTipZadatak                    = "zadatak"      // novi zadatak → oni koji mogu da vide
	ObavestenjeTipPost                       = "post"         // novi post na homepage (kasnije)
	ObavestenjeTipBroadcast                  = "broadcast"    // admin šalje svima
	ObavestenjeTipSubskripcija               = "subskripcija" // subskripcija kluba ističe uskoro → admin + sekretar
	ObavestenjeTipFollow                     = "follow"       // novi zahtev za praćenje → target korisnik
	ObavestenjeTipActionParticipationRequest = "action_participation_request"
	ObavestenjeTipSummitReward               = "summit_reward" // čestitka + preuzimanje nagrade za uspešan uspon
)

// Obavestenje je jedno obaveštenje za jednog korisnika (recipient).
type Obavestenje struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"index;not null" json:"userId"`          // kome stiže
	Type      string     `gorm:"type:varchar(30);not null" json:"type"` // uplata, akcija, zadatak, post, broadcast
	Title     string     `gorm:"type:varchar(255);not null" json:"title"`
	Body      string     `gorm:"type:text" json:"body,omitempty"`
	Link      string     `gorm:"type:varchar(500)" json:"link,omitempty"` // npr. /akcije/5, /finansije, /zadaci
	ReadAt    *time.Time `json:"readAt,omitempty"`                        // kada je pročitano; null = nepročitano
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"createdAt"`

	// Opciono: ID entiteta (akcija_id, zadatak_id, transakcija_id) za link
	Metadata string `gorm:"type:text" json:"metadata,omitempty"` // JSON npr. {"akcijaId":5}
}

func (Obavestenje) TableName() string {
	return "obavestenja"
}
