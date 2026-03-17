package models

import "time"

// Post predstavlja javnu objavu (feed) vidljivu svim ulogovanim korisnicima,
// nezavisno od kluba kome pripadaju.
type Post struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// Autor objave (korisnik iz bilo kog kluba)
	UserID uint      `gorm:"index;not null" json:"userId"`
	User   *Korisnik `gorm:"foreignKey:UserID" json:"user,omitempty"`

	// Sadržaj objave
	Content string `gorm:"type:text;not null" json:"content"`

	// Opciona slika (URL)
	ImageURL string `gorm:"type:varchar(500)" json:"imageUrl,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Post) TableName() string {
	return "posts"
}

