package models

import "time"

type TrackedActivityPoint struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ActivityID uint      `gorm:"index:idx_tracked_activity_points_activity_seq,unique;not null" json:"activityId"`
	Seq        int       `gorm:"index:idx_tracked_activity_points_activity_seq,unique;not null" json:"seq"`
	Lat        float64   `gorm:"not null" json:"lat"`
	Lng        float64   `gorm:"not null" json:"lng"`
	Altitude   *float64  `json:"altitude,omitempty"`
	Accuracy   *float64  `json:"accuracy,omitempty"`
	RecordedAt time.Time `gorm:"not null" json:"recordedAt"`
}

func (TrackedActivityPoint) TableName() string {
	return "tracked_activity_points"
}
