package guidebooking

import (
	"testing"
	"time"

	"beleg-app/backend/internal/models"
)

func TestFerrataFulfilledInfo(t *testing.T) {
	actionID := uint(42)
	req := models.FerrataGuideBookingRequest{
		Targets: []models.FerrataGuideBookingTarget{
			{Status: models.GuideBookingTargetStatusPending},
			{
				Status: models.GuideBookingTargetStatusAccepted,
				ActionID: &actionID,
				GuideProfile: &models.GuideProfile{
					KorisnikID: 1,
					Korisnik:   models.Korisnik{FullName: "Guide One"},
				},
			},
		},
	}
	fulfilled, id, name := ferrataFulfilledInfo(req)
	if !fulfilled || id == nil || *id != 42 || name != "Guide One" {
		t.Fatalf("unexpected fulfilled info: %v %v %q", fulfilled, id, name)
	}
}

func TestBuildFerrataDTO_RequestFulfilled(t *testing.T) {
	actionID := uint(7)
	req := models.FerrataGuideBookingRequest{
		ID:          1,
		FerrataID:   2,
		DesiredDate: time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC),
		TimeOfDay:   "morning",
		Targets: []models.FerrataGuideBookingTarget{
			{Status: models.GuideBookingTargetStatusAccepted, ActionID: &actionID, GuideUserID: 9, GuideProfileID: 3},
		},
	}
	dto := BuildFerrataDTO(nil, req, 9)
	if dto["requestFulfilled"] != true {
		t.Fatal("expected requestFulfilled true")
	}
	if _, ok := dto["guideResponse"]; !ok {
		t.Fatal("expected guideResponse for viewer")
	}
}
