package models

import "time"

// Post predstavlja javnu objavu (feed) vidljivu svim ulogovanim korisnicima,
// nezavisno od kluba kome pripadaju.
type Post struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// DB kolona postoji (NOT NULL) jer je tabela kreirana ranije sa ClubID.
	// Feed je globalan, ali za integritet baze moramo uvek imati vrednost.
	ClubID uint `gorm:"column:club_id;index;not null" json:"-"`

	// Autor objave (korisnik iz bilo kog kluba)
	// Tabela "posts" je ranije imala kolonu "author_id" (ne "user_id"),
	// pa mapiramo UserID na existing schema kolonu.
	UserID uint      `gorm:"column:author_id;index;not null" json:"userId"`
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

