package models

import "time"

// Post predstavlja javnu objavu (feed) unutar jednog kluba.
// Za sada podržava samo tekst + opcioni URL slike.
// Lajkovi i komentari će se dodati kasnije preko posebnih tabela.
type Post struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// Klub kome post pripada (scope da postovi budu po klubu)
	ClubID uint `gorm:"index;not null" json:"clubId"`

	// Autor objave
	AuthorID uint      `gorm:"index;not null" json:"authorId"`
	Author   *Korisnik `gorm:"foreignKey:AuthorID" json:"author,omitempty"`

	// Sadržaj objave
	Content string `gorm:"type:text;not null" json:"content"`

	// Opciona slika (Cloudinary URL ili slično)
	ImageURL string `gorm:"type:varchar(500)" json:"imageUrl,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Post) TableName() string {
	return "posts"
}

