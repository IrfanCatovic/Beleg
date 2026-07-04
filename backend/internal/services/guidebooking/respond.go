package guidebooking

import (
	"errors"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func ensureSignup(tx *gorm.DB, akcijaID, userID uint) error {
	var existing models.Prijava
	err := tx.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, userID).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return helpers.MapCreatePrijavaError(tx.Create(&models.Prijava{
		AkcijaID:   akcijaID,
		KorisnikID: userID,
		Status:     "prijavljen",
		Platio:     false,
	}).Error)
}

func validateGuideActionOrganizer(akcija *models.Akcija, guideUserID uint) error {
	if akcija.VodicID > 0 && akcija.VodicID != guideUserID {
		return ErrActionNotOwned
	}
	orgTip := strings.TrimSpace(strings.ToLower(akcija.OrganizatorTip))
	if orgTip != "vodic" && akcija.KlubID != nil && *akcija.KlubID > 0 {
		return ErrGuideOrganizer
	}
	if orgTip == "vodic" && akcija.VodicID == 0 {
		return ErrGuideMissing
	}
	return nil
}

func validateFerrataAction(akcija *models.Akcija, ferrataID uint) error {
	if akcija.TipAkcije != "via_ferrata" || akcija.FerrataID == nil || *akcija.FerrataID != ferrataID {
		return ErrInvalidAction
	}
	return nil
}

func peakActionMatchesBooking(akcija *models.Akcija, peak *models.Peak) bool {
	if akcija == nil || peak == nil {
		return false
	}
	if strings.TrimSpace(strings.ToLower(akcija.TipAkcije)) != "planina" {
		return false
	}
	peakName := strings.TrimSpace(peak.NazivVrha)
	actionPeak := strings.TrimSpace(akcija.Vrh)
	if peakName == "" || actionPeak == "" {
		return false
	}
	if !strings.EqualFold(actionPeak, peakName) {
		return false
	}
	peakMountain := strings.TrimSpace(peak.Planina)
	actionMountain := strings.TrimSpace(akcija.Planina)
	if peakMountain != "" && actionMountain != "" && !strings.EqualFold(actionMountain, peakMountain) {
		return false
	}
	return true
}

func ferrataViewerAllowed(req models.FerrataGuideBookingRequest, viewer *models.Korisnik) bool {
	if req.RequesterID == viewer.ID {
		return true
	}
	for _, t := range req.Targets {
		if t.GuideUserID == viewer.ID {
			return true
		}
	}
	return viewer.Role == "superadmin"
}

func peakViewerAllowed(req models.PeakGuideBookingRequest, viewer *models.Korisnik) bool {
	if req.RequesterID == viewer.ID {
		return true
	}
	for _, t := range req.Targets {
		if t.GuideUserID == viewer.ID {
			return true
		}
	}
	return viewer.Role == "superadmin"
}

func preloadFerrataBooking(db *gorm.DB, id uint, req *models.FerrataGuideBookingRequest) error {
	return db.
		Preload("Ferrata").
		Preload("Requester").
		Preload("Requester.Klub").
		Preload("Targets").
		Preload("Targets.GuideProfile").
		Preload("Targets.GuideProfile.Korisnik").
		First(req, id).Error
}

func preloadPeakBooking(db *gorm.DB, id uint, req *models.PeakGuideBookingRequest) error {
	return db.
		Preload("Peak").
		Preload("Requester").
		Preload("Requester.Klub").
		Preload("Targets").
		Preload("Targets.GuideProfile").
		Preload("Targets.GuideProfile.Korisnik").
		First(req, id).Error
}

func findFerrataTarget(req *models.FerrataGuideBookingRequest, guideUserID uint) *models.FerrataGuideBookingTarget {
	for i := range req.Targets {
		if req.Targets[i].GuideUserID == guideUserID {
			return &req.Targets[i]
		}
	}
	return nil
}

func findPeakTarget(req *models.PeakGuideBookingRequest, guideUserID uint) *models.PeakGuideBookingTarget {
	for i := range req.Targets {
		if req.Targets[i].GuideUserID == guideUserID {
			return &req.Targets[i]
		}
	}
	return nil
}

func acceptConflictFromFerrata(req models.FerrataGuideBookingRequest) AcceptConflict {
	fulfilled, actionID, guideName := ferrataFulfilledInfo(req)
	if !fulfilled {
		return AcceptConflict{}
	}
	return AcceptConflict{FulfilledActionID: actionID, FulfilledByGuideName: guideName}
}

func acceptConflictFromPeak(req models.PeakGuideBookingRequest) AcceptConflict {
	fulfilled, actionID, guideName := peakFulfilledInfo(req)
	if !fulfilled {
		return AcceptConflict{}
	}
	return AcceptConflict{FulfilledActionID: actionID, FulfilledByGuideName: guideName}
}

func closeOtherFerrataPending(tx *gorm.DB, req *models.FerrataGuideBookingRequest, targetID uint, now time.Time) error {
	if err := tx.Model(&models.FerrataGuideBookingTarget{}).
		Where("booking_request_id = ? AND id <> ? AND status = ?", req.ID, targetID, models.GuideBookingTargetStatusPending).
		Updates(map[string]any{"status": models.GuideBookingTargetStatusClosed, "responded_at": now}).Error; err != nil {
		return err
	}
	for i := range req.Targets {
		if req.Targets[i].ID != targetID && req.Targets[i].Status == models.GuideBookingTargetStatusPending {
			req.Targets[i].Status = models.GuideBookingTargetStatusClosed
			req.Targets[i].RespondedAt = &now
		}
	}
	return nil
}

func closeOtherPeakPending(tx *gorm.DB, req *models.PeakGuideBookingRequest, targetID uint, now time.Time) error {
	if err := tx.Model(&models.PeakGuideBookingTarget{}).
		Where("booking_request_id = ? AND id <> ? AND status = ?", req.ID, targetID, models.GuideBookingTargetStatusPending).
		Updates(map[string]any{"status": models.GuideBookingTargetStatusClosed, "responded_at": now}).Error; err != nil {
		return err
	}
	for i := range req.Targets {
		if req.Targets[i].ID != targetID && req.Targets[i].Status == models.GuideBookingTargetStatusPending {
			req.Targets[i].Status = models.GuideBookingTargetStatusClosed
			req.Targets[i].RespondedAt = &now
		}
	}
	return nil
}
