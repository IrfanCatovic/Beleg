package guidebooking

import (
	"encoding/json"
	"strings"
	"time"

	"beleg-app/backend/internal/apperror"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

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

func NotifyFerrataTargets(db *gorm.DB, req models.FerrataGuideBookingRequest, targets []models.FerrataGuideBookingTarget) {
	requesterName := displayName(req.Requester.FullName, req.Requester.Username, "Korisnik")
	ferrataName := strings.TrimSpace(req.Ferrata.Naziv)
	if ferrataName == "" {
		ferrataName = "feratu"
	}
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Imate novi zahtev za akciju"
	body := requesterName + " traži vođenje na ferati \"" + ferrataName + "\" za datum " + dateStr + "."

	metaBase := map[string]any{
		"bookingKind":       "ferrata",
		"bookingRequestId": req.ID,
		"ferrataId":        req.FerrataID,
		"ferrataNaziv":     ferrataName,
		"requesterId":      req.RequesterID,
		"requesterUsername": req.Requester.Username,
		"requesterFullName": req.Requester.FullName,
		"desiredDate":      req.DesiredDate.Format("2006-01-02"),
		"numberOfPeople":   req.NumberOfPeople,
	}

	seen := map[uint]bool{}
	for _, t := range targets {
		if t.GuideUserID == 0 || seen[t.GuideUserID] {
			continue
		}
		seen[t.GuideUserID] = true
		meta := metaBase
		meta["guideProfileId"] = t.GuideProfileID
		metaBytes, _ := json.Marshal(meta)
		notifications.NotifyUsers(db, []uint{t.GuideUserID}, models.ObavestenjeTipGuideBookingRequest, title, body, "", string(metaBytes))
	}
}

func NotifyPeakTargets(db *gorm.DB, req models.PeakGuideBookingRequest, targets []models.PeakGuideBookingTarget) {
	requesterName := displayName(req.Requester.FullName, req.Requester.Username, "Korisnik")
	peakName := peakDisplayName(req.Peak)
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Imate novi zahtev za akciju"
	body := requesterName + " traži vođenje na vrh \"" + peakName + "\" za datum " + dateStr + "."

	metaBase := map[string]any{
		"bookingKind":       "peak",
		"bookingRequestId":  req.ID,
		"peakId":            req.PeakID,
		"peakNaziv":         peakName,
		"requesterId":       req.RequesterID,
		"requesterUsername": req.Requester.Username,
		"requesterFullName": req.Requester.FullName,
		"desiredDate":       req.DesiredDate.Format("2006-01-02"),
		"numberOfPeople":    req.NumberOfPeople,
	}

	seen := map[uint]bool{}
	for _, t := range targets {
		if t.GuideUserID == 0 || seen[t.GuideUserID] {
			continue
		}
		seen[t.GuideUserID] = true
		meta := metaBase
		meta["guideProfileId"] = t.GuideProfileID
		metaBytes, _ := json.Marshal(meta)
		notifications.NotifyUsers(db, []uint{t.GuideUserID}, models.ObavestenjeTipGuideBookingRequest, title, body, "", string(metaBytes))
	}
}

func displayName(fullName, username, fallback string) string {
	if n := strings.TrimSpace(fullName); n != "" {
		return n
	}
	if n := strings.TrimSpace(username); n != "" {
		return n
	}
	return fallback
}

func peakDisplayName(peak *models.Peak) string {
	if peak == nil {
		return "vrh"
	}
	if n := strings.TrimSpace(peak.NazivVrha); n != "" {
		return n
	}
	return "vrh"
}
