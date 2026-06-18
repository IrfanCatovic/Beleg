package models

import "time"

// PeakGuideBookingRequest zahtev korisnika za vođenje na vrh.
type PeakGuideBookingRequest struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	PeakID            uint      `gorm:"column:peak_id;index;not null" json:"peakId"`
	RequesterID       uint      `gorm:"column:requester_id;index;not null" json:"requesterId"`
	DesiredDate       time.Time `gorm:"column:desired_date;type:date;not null" json:"desiredDate"`
	TimeOfDay         string    `gorm:"column:time_of_day;type:varchar(20);not null" json:"timeOfDay"`
	ExactTime         string    `gorm:"column:exact_time;type:varchar(10)" json:"exactTime,omitempty"`
	DateFlexible      bool      `gorm:"column:date_flexible;not null;default:false" json:"dateFlexible"`
	NumberOfPeople    int       `gorm:"column:number_of_people;not null" json:"numberOfPeople"`
	GroupExperience   string    `gorm:"column:group_experience;type:varchar(30);not null" json:"groupExperience"`
	EquipmentStatus   string    `gorm:"column:equipment_status;type:varchar(30);not null" json:"equipmentStatus"`
	ContactPhone      string    `gorm:"column:contact_phone;type:varchar(50);not null" json:"contactPhone"`
	AdditionalMessage string    `gorm:"column:additional_message;type:text" json:"additionalMessage,omitempty"`
	SkipGuides        bool      `gorm:"column:skip_guides;not null;default:false" json:"skipGuides"`
	CreatedAt         time.Time `json:"createdAt"`

	Peak      *Peak                    `gorm:"foreignKey:PeakID" json:"-"`
	Requester *Korisnik                `gorm:"foreignKey:RequesterID" json:"-"`
	Targets   []PeakGuideBookingTarget `gorm:"foreignKey:BookingRequestID" json:"targets,omitempty"`
}

func (PeakGuideBookingRequest) TableName() string {
	return "peak_guide_booking_requests"
}

// PeakGuideBookingTarget vodič kome je poslat zahtev za uspon na vrh.
type PeakGuideBookingTarget struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	BookingRequestID uint       `gorm:"column:booking_request_id;index;not null" json:"bookingRequestId"`
	GuideProfileID   uint       `gorm:"column:guide_profile_id;index;not null" json:"guideProfileId"`
	GuideUserID      uint       `gorm:"column:guide_user_id;index;not null" json:"guideUserId"`
	Status           string     `gorm:"column:status;type:varchar(20);not null;default:pending" json:"status"`
	ActionID         *uint      `gorm:"column:action_id;index" json:"actionId,omitempty"`
	RespondedAt      *time.Time `gorm:"column:responded_at" json:"respondedAt,omitempty"`

	GuideProfile *GuideProfile `gorm:"foreignKey:GuideProfileID" json:"-"`
}

func (PeakGuideBookingTarget) TableName() string {
	return "peak_guide_booking_targets"
}
