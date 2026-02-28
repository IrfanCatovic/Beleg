package models

import "time"

type Korisnik struct {
	ID                         uint      `gorm:"primaryKey" json:"id"`

	// Obavezna polja (username unique, password hashed)
	Username                   string    `gorm:"unique;not null" json:"username"` // jedinstveno, obavezno
	Password                   string    `json:"-"`                               // hashed, obavezno, ne vraća se u JSON
	// Opciono korisnik sam popunjava posle registracije
	FullName                   string    `gorm:"type:varchar(100)" json:"fullName,omitempty"`
	ImeRoditelja               string    `gorm:"type:varchar(100)" json:"ime_roditelja,omitempty"`
	Pol                        string    `gorm:"type:varchar(20)" json:"pol,omitempty"` // "M", "Ž"
	DatumRodjenja              *time.Time `json:"datum_rodjenja,omitempty"`               // pointer da može biti null
	Drzavljanstvo              string    `gorm:"type:varchar(100)" json:"drzavljanstvo,omitempty"`
	Adresa                     string    `gorm:"type:varchar(255)" json:"adresa,omitempty"`
	Telefon                    string    `gorm:"type:varchar(50)" json:"telefon,omitempty"`
	Email                      string    `gorm:"type:varchar(255)" json:"email,omitempty"` // može biti unique ako želiš
	BrojLicnogDokumenta        string    `gorm:"type:varchar(50)" json:"broj_licnog_dokumenta,omitempty"`
	BrojPlaninarskeLegitimacije string    `gorm:"type:varchar(50);unique_index" json:"broj_planinarske_legitimacije,omitempty"` // unique ako želiš
	BrojPlaninarskeMarkice     string    `gorm:"type:varchar(50)" json:"broj_planinarske_markice,omitempty"`
	DatumUclanjenja            *time.Time `json:"datum_uclanjenja,omitempty"`

	// Opciona tekstualna polja
	IzreceneDisciplinskeKazne  string    `gorm:"type:text" json:"izrecene_disciplinske_kazne,omitempty"`
	IzborUOrganeSportskogUdruzenja string `gorm:"type:text" json:"izbor_u_organe_sportskog_udruzenja,omitempty"`
	Napomene                   string    `gorm:"type:text" json:"napomene,omitempty"`

	// Slika (opciono)
	AvatarURL                  string    `gorm:"type:varchar(500)" json:"avatar_url,omitempty"`
	// Role i status
	Role                       string    `gorm:"type:varchar(20);not null;default:'clan'" json:"role"`
	// Statistika (opciono, default 0)
	UkupnoKmKorisnik           float64   `gorm:"default:0" json:"ukupnoKm"`
	UkupnoMetaraUsponaKorisnik int       `gorm:"default:0" json:"ukupnoMetaraUspona"`
	BrojPopeoSe                int       `gorm:"default:0" json:"brojPopeoSe"`

	// Timestamps (automatski)
	CreatedAt                  time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt                  time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
}



func (Korisnik) TableName() string {
	return "korisnici" //name of talbe in PgAdmin
}
