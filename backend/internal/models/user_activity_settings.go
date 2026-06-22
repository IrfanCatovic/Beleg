package models

import "time"

type UserActivitySettings struct {
	UserID        uint      `gorm:"primaryKey" json:"userId"`
	DailyStepGoal int       `gorm:"not null;default:10000" json:"dailyStepGoal"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (UserActivitySettings) TableName() string {
	return "user_activity_settings"
}
