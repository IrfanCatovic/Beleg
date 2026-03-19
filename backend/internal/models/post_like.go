package models

import "time"

type PostLike struct {
	ID uint `gorm:"primaryKey" json:"id"`

	PostID uint `gorm:"index;not null;uniqueIndex:idx_post_like_user" json:"postId"`
	UserID uint `gorm:"index;not null;uniqueIndex:idx_post_like_user" json:"userId"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (PostLike) TableName() string {
	return "post_likes"
}

