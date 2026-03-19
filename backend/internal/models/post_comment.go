package models

import "time"

type PostComment struct {
	ID uint `gorm:"primaryKey" json:"id"`

	PostID uint `gorm:"index;not null" json:"postId"`
	UserID uint `gorm:"index;not null" json:"userId"`

	Content string `gorm:"type:text;not null" json:"content"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`

	// Relacije za GORM preload (opcioni)
	User *Korisnik `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (PostComment) TableName() string {
	return "post_comments"
}

