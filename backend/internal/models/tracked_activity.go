package models

import "time"

const (
	TrackedActivityStatusActive    = "active"
	TrackedActivityStatusCompleted = "completed"
	TrackedActivityStatusDiscarded = "discarded"
)

type TrackedActivity struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	UserID          uint       `gorm:"index;not null" json:"userId"`
	Status          string     `gorm:"type:varchar(20);not null;default:'active'" json:"status"`
	StartedAt       time.Time  `gorm:"not null" json:"startedAt"`
	EndedAt         *time.Time `json:"endedAt,omitempty"`
	DurationSec     int        `gorm:"default:0" json:"durationSec"`
	DistanceM       float64    `gorm:"default:0" json:"distanceM"`
	ElevationGainM  float64    `gorm:"default:0" json:"elevationGainM"`
	Steps           int        `gorm:"default:0" json:"steps"`
	StartLat        *float64   `json:"startLat,omitempty"`
	StartLng        *float64   `json:"startLng,omitempty"`
	EndLat          *float64   `json:"endLat,omitempty"`
	EndLng          *float64   `json:"endLng,omitempty"`
	RoutePolyline   string     `gorm:"type:text" json:"routePolyline,omitempty"`
	KlubID          *uint      `gorm:"index" json:"klubId,omitempty"`
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (TrackedActivity) TableName() string {
	return "tracked_activities"
}
