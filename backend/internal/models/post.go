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
	// Tabela "posts" je prošla kroz promene (ranije je FK bio "author_id",
	// a sada je "user_id" NOT NULL u šemi). Da bismo bili kompatibilni sa obe
	// kolone u realnoj bazi, mapiramo oba.
	UserID uint `gorm:"column:user_id;index;not null" json:"userId"`

	// author_id postoji u bazi (ranije smo ga koristili kao FK).
	// Nema relaciju, samo ga popunjavamo da ne padne NOT NULL constraint.
	AuthorID uint `gorm:"column:author_id;index;not null" json:"-"`
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

