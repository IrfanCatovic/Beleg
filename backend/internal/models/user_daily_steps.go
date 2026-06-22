package models

import "time"

type UserDailySteps struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index:idx_user_daily_steps_user_date,unique;not null" json:"userId"`
	Date      time.Time `gorm:"type:date;index:idx_user_daily_steps_user_date,unique;not null" json:"date"`
	Steps     int       `gorm:"not null;default:0" json:"steps"`
	Source    string    `gorm:"type:varchar(20);default:'pedometer'" json:"source"`
	SyncedAt  time.Time `gorm:"autoUpdateTime" json:"syncedAt"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (UserDailySteps) TableName() string {
	return "user_daily_steps"
}
