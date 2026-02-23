package models

import "time"

type Korisnik struct {
	ID                         uint      `gorm:"primaryKey" json:"id"`
	Username                   string    `gorm:"unique" json:"username"`
	Password                   string    `json:"-"`
	FullName                   string    `json:"fullName"`
	Role                       string    `gorm:"type:varchar(20);not null" json:"role"`
	CreatedAt                  time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UkupnoKmKorisnik           float64   `json:"ukupnoKm"`
	UkupnoMetaraUsponaKorisnik int       `json:"ukupnoMetaraUspona"`
	BrojPopeoSe                int       `json:"brojPopeoSe"`
}

func (Korisnik) TableName() string {
	return "korisnici" //name of talbe in PgAdmin
}
