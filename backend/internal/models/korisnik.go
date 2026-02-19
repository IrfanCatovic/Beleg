package models

import "time"

type Korisnik struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    Username  string    `gorm:"unique" json:"username"`
    Password  string    `json:"-"`
    FullName  string    `json:"fullName"`
    Role      string    `json:"role"` 
    CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
    UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Korisnik) TableName() string {
    return "korisnici" //name of talbe in PgAdmin
}