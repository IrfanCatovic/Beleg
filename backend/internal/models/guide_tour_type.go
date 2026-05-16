package models

import "time"

const (
	GuideTourViaFerrata         = "via_ferrata"
	GuideTourPlaninarska        = "planinarska_tura"
	GuideTourUsponNaVrh         = "uspon_na_vrh"
	GuideTourVisokogorska       = "visokogorska_tura"
	GuideTourZimska             = "zimska_tura"
	GuideTourAlpinisticka       = "alpinisticka_tura"
	GuideTourVisednevna         = "visednevna_tura"
	GuideTourPorodicna          = "porodicna_tura"
	GuideTourPrivatna           = "privatna_tura"
	GuideTourEdukativna         = "edukativna_tura"
)

var AllowedGuideTourTypes = map[string]bool{
	GuideTourViaFerrata:   true,
	GuideTourPlaninarska:  true,
	GuideTourUsponNaVrh:   true,
	GuideTourVisokogorska: true,
	GuideTourZimska:       true,
	GuideTourAlpinisticka: true,
	GuideTourVisednevna:   true,
	GuideTourPorodicna:    true,
	GuideTourPrivatna:     true,
	GuideTourEdukativna:   true,
}

// GuideTourType vrsta ture koju vodič nudi (checkbox izbor).
type GuideTourType struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	GuideProfileID uint      `gorm:"column:guide_profile_id;not null;uniqueIndex:idx_guide_tour_type_unique" json:"guideProfileId"`
	Type           string    `gorm:"type:varchar(40);not null;uniqueIndex:idx_guide_tour_type_unique" json:"type"`
	CreatedAt      time.Time `json:"createdAt"`
}

func (GuideTourType) TableName() string {
	return "guide_tour_types"
}
