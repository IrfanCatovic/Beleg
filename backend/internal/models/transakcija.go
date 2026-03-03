package models

import "time"

// Transakcija predstavlja jednu uplatu ili isplatu.
// Tip: "uplata" = prihod, "isplata" = rashod.
type Transakcija struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Tip        string    `gorm:"type:varchar(20);not null" json:"tip"` // "uplata" ili "isplata"
	Iznos      float64   `gorm:"not null" json:"iznos"`
	Opis       string    `gorm:"type:text" json:"opis,omitempty"`
	Datum      time.Time `gorm:"not null" json:"datum"`
	KorisnikID uint      `gorm:"index;not null" json:"korisnikId"` // Ko je uneo transakciju (admin/blagajnik)

	// Za članarinu: ako je uplata tipa članarina, ovde je ID člana koji je platio
	ClanarinaKorisnikID *uint `gorm:"index" json:"clanarinaKorisnikId,omitempty"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`

	// Relacije Preload za prikaz imena
	Korisnik           Korisnik  `gorm:"foreignKey:KorisnikID"`           // Ko je uneo
	ClanarinaKorisnik  *Korisnik `gorm:"foreignKey:ClanarinaKorisnikID"`  // Ko je platio članarinu (ako je uplata)
}

func (Transakcija) TableName() string {
	return "transakcije"
}
