package models

import "time"

// CloudinaryPendingDelete - slike zamenjene novim, za brisanje iz Cloudinary nakon 60 dana (praksa velikih kompanija).
type CloudinaryPendingDelete struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	PublicID   string    `gorm:"type:varchar(512);not null;index" json:"public_id"`   // Cloudinary public_id (može sadržati /)
	DeleteAfter time.Time `gorm:"not null;index" json:"delete_after"`               // brisati kada ovo <= danas
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (CloudinaryPendingDelete) TableName() string {
	return "cloudinary_pending_deletes"
}
