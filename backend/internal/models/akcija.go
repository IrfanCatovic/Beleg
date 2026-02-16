package models

import "time"

type Akcija struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Naziv     string    `json:"naziv"`
	Vrh       string    `json:"vrh"`
	Datum     time.Time `json:"datum"`
	Opis      string    `json:"opis,omitempty"`
	Tezina    string    `json:"tezina,omitempty"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}
