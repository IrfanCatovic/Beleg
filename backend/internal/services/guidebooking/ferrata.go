package guidebooking

import (
	"errors"
	"time"

	"beleg-app/backend/internal/apperror"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func GetFerrata(db *gorm.DB, bookingID uint, viewer *models.Korisnik) (*BookingViewResult, *apperror.Error) {
	var req models.FerrataGuideBookingRequest
	if err := preloadFerrataBooking(db, bookingID, &req); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.New("NOT_FOUND", "Zahtev nije pronađen.", 404)
		}
		return nil, apperror.New("INTERNAL", "Greška pri učitavanju zahteva.", 500)
	}
	if !ferrataViewerAllowed(req, viewer) {
		return nil, apperror.New("FORBIDDEN", "Nemate pristup ovom zahtevu.", 403)
	}
	return &BookingViewResult{Booking: BuildFerrataDTO(db, req, viewer.ID)}, nil
}

func RejectFerrata(db *gorm.DB, bookingID uint, viewer *models.Korisnik) (*BookingViewResult, *apperror.Error) {
	var req models.FerrataGuideBookingRequest
	if err := preloadFerrataBooking(db, bookingID, &req); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.New("NOT_FOUND", "Zahtev nije pronađen.", 404)
		}
		return nil, apperror.New("INTERNAL", "Greška pri učitavanju zahteva.", 500)
	}
	target := findFerrataTarget(&req, viewer.ID)
	if target == nil {
		return nil, apperror.New("FORBIDDEN", "Niste vodič za ovaj zahtev.", 403)
	}
	if target.Status != models.GuideBookingTargetStatusPending {
		return nil, apperror.New("CONFLICT", "Zahtev je već obrađen.", 409)
	}
	if fulfilled, _, _ := ferrataFulfilledInfo(req); fulfilled {
		return nil, apperror.New("CONFLICT", "Zahtev je već rešen — drugi vodič je kreirao akciju.", 409)
	}
	now := time.Now()
	if err := db.Model(target).Updates(map[string]any{
		"status": models.GuideBookingTargetStatusRejected, "responded_at": now,
	}).Error; err != nil {
		return nil, apperror.New("INTERNAL", "Odbijanje nije uspelo.", 500)
	}
	target.Status = models.GuideBookingTargetStatusRejected
	target.RespondedAt = &now
	NotifyFerrataRequesterRejected(db, req, *target, *viewer)
	return &BookingViewResult{Booking: BuildFerrataDTO(db, req, viewer.ID)}, nil
}

func AcceptFerrata(db *gorm.DB, bookingID uint, viewer *models.Korisnik, actionID uint) (*BookingViewResult, *AcceptConflict, error) {
	var akcija models.Akcija
	if err := db.First(&akcija, actionID).Error; err != nil {
		return nil, nil, ErrActionNotFound
	}

	var req models.FerrataGuideBookingRequest
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Preload("Ferrata").
			Preload("Requester").
			Preload("Requester.Klub").
			Preload("Targets").
			Preload("Targets.GuideProfile").
			Preload("Targets.GuideProfile.Korisnik").
			Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&req, bookingID).Error; err != nil {
			return err
		}

		target := findFerrataTarget(&req, viewer.ID)
		if target == nil {
			return ErrNotGuideTarget
		}
		if target.Status != models.GuideBookingTargetStatusPending {
			return ErrAlreadyFulfilled
		}
		if fulfilled, _, _ := ferrataFulfilledInfo(req); fulfilled {
			return ErrAlreadyFulfilled
		}
		if err := validateFerrataAction(&akcija, req.FerrataID); err != nil {
			return err
		}
		if err := validateGuideActionOrganizer(&akcija, viewer.ID); err != nil {
			return err
		}
		if err := ensureSignup(tx, akcija.ID, req.RequesterID); err != nil {
			return err
		}
		if err := ensureSignup(tx, akcija.ID, viewer.ID); err != nil {
			return err
		}

		now := time.Now()
		if err := tx.Model(target).Updates(map[string]any{
			"status": models.GuideBookingTargetStatusAccepted, "action_id": actionID, "responded_at": now,
		}).Error; err != nil {
			return err
		}
		target.Status = models.GuideBookingTargetStatusAccepted
		target.ActionID = &actionID
		target.RespondedAt = &now
		return closeOtherFerrataPending(tx, &req, target.ID, now)
	})

	if err != nil {
		if errors.Is(err, ErrAlreadyFulfilled) {
			conflict := acceptConflictFromFerrata(req)
			return nil, &conflict, ErrAlreadyFulfilled
		}
		return nil, nil, err
	}

	NotifyFerrataRequesterFulfilled(db, req, *viewer, actionID)
	return &BookingViewResult{Booking: BuildFerrataDTO(db, req, viewer.ID)}, nil, nil
}
