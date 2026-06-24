package guidebooking

import (
	"strings"
	"time"

	"beleg-app/backend/internal/apperror"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// GuideTarget opisuje jednog vodiča koji je meta guide booking zahteva.
type GuideTarget struct {
	GuideProfileID uint
	GuideUserID    uint
}

// ResolveApprovedGuideTargets proverava da su svi guide profile ID-jevi odobreni.
func ResolveApprovedGuideTargets(db *gorm.DB, guideIDs []uint) ([]GuideTarget, *apperror.Error) {
	if len(guideIDs) == 0 {
		return nil, nil
	}
	var profiles []models.GuideProfile
	if err := db.Where("id IN ? AND status = ?", guideIDs, models.GuideStatusApproved).Find(&profiles).Error; err != nil {
		return nil, apperror.New("INTERNAL", "Greška pri proveri vodiča.", 500)
	}
	if len(profiles) != len(guideIDs) {
		return nil, apperror.New("VALIDATION", "Jedan ili više vodiča nije dostupan.", 400)
	}
	targets := make([]GuideTarget, 0, len(profiles))
	for _, p := range profiles {
		targets = append(targets, GuideTarget{GuideProfileID: p.ID, GuideUserID: p.KorisnikID})
	}
	return targets, nil
}

type CreateFerrataInput struct {
	FerrataID         uint
	Requester         *models.Korisnik
	DesiredDate       time.Time
	TimeOfDay         string
	ExactTime         string
	DateFlexible      bool
	NumberOfPeople    int
	GroupExperience   string
	EquipmentStatus   string
	ContactPhone      string
	AdditionalMessage string
	SkipGuides        bool
	GuideProfileIDs   []uint
}

type CreateFerrataResult struct {
	Request       models.FerrataGuideBookingRequest
	Targets       []models.FerrataGuideBookingTarget
	NotifiedCount int
}

func CreateFerrata(db *gorm.DB, in CreateFerrataInput) (*CreateFerrataResult, *apperror.Error) {
	var ferrata models.Ferrata
	if err := db.First(&ferrata, in.FerrataID).Error; err != nil {
		return nil, apperror.New("NOT_FOUND", "Ferata nije pronađena.", 404)
	}

	guideIDs := UniqueUints(in.GuideProfileIDs)
	if msg := ValidateGuideTargets(in.SkipGuides, guideIDs); msg != "" {
		return nil, apperror.New("VALIDATION", msg, 400)
	}

	resolved, svcErr := ResolveApprovedGuideTargets(db, guideIDs)
	if svcErr != nil {
		return nil, svcErr
	}

	var targets []models.FerrataGuideBookingTarget
	for _, t := range resolved {
		targets = append(targets, models.FerrataGuideBookingTarget{
			GuideProfileID: t.GuideProfileID,
			GuideUserID:    t.GuideUserID,
			Status:         models.GuideBookingTargetStatusPending,
		})
	}

	req := models.FerrataGuideBookingRequest{
		FerrataID:         ferrata.ID,
		RequesterID:       in.Requester.ID,
		DesiredDate:       in.DesiredDate,
		TimeOfDay:         in.TimeOfDay,
		ExactTime:         strings.TrimSpace(in.ExactTime),
		DateFlexible:      in.DateFlexible,
		NumberOfPeople:    in.NumberOfPeople,
		GroupExperience:   in.GroupExperience,
		EquipmentStatus:   in.EquipmentStatus,
		ContactPhone:      in.ContactPhone,
		AdditionalMessage: strings.TrimSpace(in.AdditionalMessage),
		SkipGuides:        in.SkipGuides,
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&req).Error; err != nil {
			return err
		}
		for i := range targets {
			targets[i].BookingRequestID = req.ID
		}
		if len(targets) > 0 {
			return tx.Create(&targets).Error
		}
		return nil
	}); err != nil {
		return nil, apperror.New("INTERNAL", "Čuvanje zahteva nije uspelo.", 500)
	}

	if len(targets) > 0 {
		req.Requester = in.Requester
		req.Ferrata = &ferrata
		NotifyFerrataTargets(db, req, targets)
	}

	return &CreateFerrataResult{
		Request:       req,
		Targets:       targets,
		NotifiedCount: len(targets),
	}, nil
}

type CreatePeakInput struct {
	PeakID            uint
	Requester         *models.Korisnik
	DesiredDate       time.Time
	TimeOfDay         string
	ExactTime         string
	DateFlexible      bool
	NumberOfPeople    int
	GroupExperience   string
	EquipmentStatus   string
	ContactPhone      string
	AdditionalMessage string
	SkipGuides        bool
	GuideProfileIDs   []uint
}

type CreatePeakResult struct {
	Request       models.PeakGuideBookingRequest
	Targets       []models.PeakGuideBookingTarget
	NotifiedCount int
}

func CreatePeak(db *gorm.DB, in CreatePeakInput) (*CreatePeakResult, *apperror.Error) {
	var peak models.Peak
	if err := db.Where("id = ? AND status = ?", in.PeakID, "active").First(&peak).Error; err != nil {
		return nil, apperror.New("NOT_FOUND", "Vrh nije pronađen.", 404)
	}

	guideIDs := UniqueUints(in.GuideProfileIDs)
	if msg := ValidateGuideTargets(in.SkipGuides, guideIDs); msg != "" {
		return nil, apperror.New("VALIDATION", msg, 400)
	}

	resolved, svcErr := ResolveApprovedGuideTargets(db, guideIDs)
	if svcErr != nil {
		return nil, svcErr
	}

	var targets []models.PeakGuideBookingTarget
	for _, t := range resolved {
		targets = append(targets, models.PeakGuideBookingTarget{
			GuideProfileID: t.GuideProfileID,
			GuideUserID:    t.GuideUserID,
			Status:         models.GuideBookingTargetStatusPending,
		})
	}

	req := models.PeakGuideBookingRequest{
		PeakID:            peak.ID,
		RequesterID:       in.Requester.ID,
		DesiredDate:       in.DesiredDate,
		TimeOfDay:         in.TimeOfDay,
		ExactTime:         strings.TrimSpace(in.ExactTime),
		DateFlexible:      in.DateFlexible,
		NumberOfPeople:    in.NumberOfPeople,
		GroupExperience:   in.GroupExperience,
		EquipmentStatus:   in.EquipmentStatus,
		ContactPhone:      in.ContactPhone,
		AdditionalMessage: strings.TrimSpace(in.AdditionalMessage),
		SkipGuides:        in.SkipGuides,
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&req).Error; err != nil {
			return err
		}
		for i := range targets {
			targets[i].BookingRequestID = req.ID
		}
		if len(targets) > 0 {
			return tx.Create(&targets).Error
		}
		return nil
	}); err != nil {
		return nil, apperror.New("INTERNAL", "Čuvanje zahteva nije uspelo.", 500)
	}

	if len(targets) > 0 {
		req.Requester = in.Requester
		req.Peak = &peak
		NotifyPeakTargets(db, req, targets)
	}

	return &CreatePeakResult{
		Request:       req,
		Targets:       targets,
		NotifiedCount: len(targets),
	}, nil
}
