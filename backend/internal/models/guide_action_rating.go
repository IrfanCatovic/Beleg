package models

import "time"

// GuideActionRating ocena vodiča od učesnika nakon završene akcije (jedna po učesniku i akciji).
type GuideActionRating struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	AkcijaID        uint      `gorm:"column:akcija_id;not null;uniqueIndex:idx_guide_rating_akcija_rater" json:"akcijaId"`
	RaterKorisnikID uint      `gorm:"column:rater_korisnik_id;not null;uniqueIndex:idx_guide_rating_akcija_rater" json:"raterKorisnikId"`
	GuideProfileID  uint      `gorm:"column:guide_profile_id;not null;index" json:"guideProfileId"`
	GuideKorisnikID uint      `gorm:"column:guide_korisnik_id;not null;index" json:"guideKorisnikId"`
	Ocena           *int      `gorm:"column:ocena" json:"ocena,omitempty"`
	Komentar        string    `gorm:"column:komentar;type:text" json:"komentar,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`

	Akcija       Akcija       `gorm:"foreignKey:AkcijaID" json:"-"`
	Rater        Korisnik     `gorm:"foreignKey:RaterKorisnikID" json:"-"`
	GuideProfile GuideProfile `gorm:"foreignKey:GuideProfileID" json:"-"`
}

func (GuideActionRating) TableName() string {
	return "guide_action_ratings"
}
