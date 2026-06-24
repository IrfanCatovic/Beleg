package guidebooking

import (
	"strings"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

type guideTargetView struct {
	GuideUserID    uint
	GuideProfileID uint
	GuideName      string
	Status         string
	ActionID       *uint
	RespondedAt    interface{}
	TargetID       uint
}

// BookingViewResult je JSON-serijalizabilan booking DTO.
type BookingViewResult struct {
	Booking map[string]any
}

func ferrataFulfilledInfo(req models.FerrataGuideBookingRequest) (bool, *uint, string) {
	for _, t := range req.Targets {
		if t.Status == models.GuideBookingTargetStatusAccepted && t.ActionID != nil {
			return true, t.ActionID, guideNameFromProfile(t.GuideProfile)
		}
	}
	return false, nil, ""
}

func peakFulfilledInfo(req models.PeakGuideBookingRequest) (bool, *uint, string) {
	for _, t := range req.Targets {
		if t.Status == models.GuideBookingTargetStatusAccepted && t.ActionID != nil {
			return true, t.ActionID, guideNameFromProfile(t.GuideProfile)
		}
	}
	return false, nil, ""
}

func guideNameFromProfile(p *models.GuideProfile) string {
	if p == nil || p.KorisnikID == 0 {
		return ""
	}
	name := strings.TrimSpace(p.Korisnik.FullName)
	if name == "" {
		name = strings.TrimSpace(p.Korisnik.Username)
	}
	return name
}

func buildRequesterPayload(db *gorm.DB, requester *models.Korisnik) map[string]any {
	if requester == nil {
		return map[string]any{"id": 0}
	}
	payload := map[string]any{"id": requester.ID}
	payload["username"] = requester.Username
	payload["fullName"] = requester.FullName
	payload["avatarUrl"] = requester.AvatarURL
	payload["telefon"] = requester.Telefon
	payload["isProfiGuide"] = helpers.KorisnikIsApprovedProfiGuide(db, requester.ID)
	if requester.Klub != nil {
		payload["klubNaziv"] = requester.Klub.Naziv
	}
	return payload
}

func appendGuideResponses(payload map[string]any, views []guideTargetView, viewerID uint, fulfilled bool) {
	var guideResponses []map[string]any
	for _, t := range views {
		entry := map[string]any{
			"guideUserId":    t.GuideUserID,
			"guideProfileId": t.GuideProfileID,
			"guideName":      t.GuideName,
			"status":         t.Status,
			"actionId":       t.ActionID,
			"respondedAt":    t.RespondedAt,
		}
		guideResponses = append(guideResponses, entry)
		if t.GuideUserID == viewerID {
			payload["guideResponse"] = map[string]any{
				"status":     t.Status,
				"canRespond": !fulfilled && t.Status == models.GuideBookingTargetStatusPending,
				"actionId":   t.ActionID,
				"targetId":   t.TargetID,
			}
		}
	}
	if len(guideResponses) > 0 {
		payload["guideResponses"] = guideResponses
	}
}

func BuildFerrataDTO(db *gorm.DB, req models.FerrataGuideBookingRequest, viewerID uint) map[string]any {
	ferrataPayload := map[string]any{
		"id":    req.FerrataID,
		"naziv": "",
		"slug":  "",
	}
	if req.Ferrata != nil {
		ferrataPayload["naziv"] = req.Ferrata.Naziv
		ferrataPayload["slug"] = req.Ferrata.Slug
		ferrataPayload["gradOpstina"] = req.Ferrata.GradOpstina
		ferrataPayload["drzava"] = req.Ferrata.Drzava
		ferrataPayload["lokacija"] = req.Ferrata.Lokacija
	}

	payload := map[string]any{
		"id":                req.ID,
		"ferrataId":         req.FerrataID,
		"desiredDate":       req.DesiredDate.Format("2006-01-02"),
		"timeOfDay":         req.TimeOfDay,
		"exactTime":         req.ExactTime,
		"dateFlexible":      req.DateFlexible,
		"numberOfPeople":    req.NumberOfPeople,
		"groupExperience":   req.GroupExperience,
		"equipmentStatus":   req.EquipmentStatus,
		"contactPhone":      req.ContactPhone,
		"additionalMessage": req.AdditionalMessage,
		"skipGuides":        req.SkipGuides,
		"createdAt":         req.CreatedAt,
		"ferrata":           ferrataPayload,
		"requester":         buildRequesterPayload(db, req.Requester),
	}

	fulfilled, fulfilledActionID, fulfilledGuideName := ferrataFulfilledInfo(req)
	if fulfilled {
		payload["requestFulfilled"] = true
		payload["fulfilledActionId"] = fulfilledActionID
		if fulfilledGuideName != "" {
			payload["fulfilledByGuideName"] = fulfilledGuideName
		}
	} else {
		payload["requestFulfilled"] = false
	}

	views := make([]guideTargetView, 0, len(req.Targets))
	for _, t := range req.Targets {
		views = append(views, guideTargetView{
			GuideUserID:    t.GuideUserID,
			GuideProfileID: t.GuideProfileID,
			GuideName:      guideNameFromProfile(t.GuideProfile),
			Status:         t.Status,
			ActionID:       t.ActionID,
			RespondedAt:    t.RespondedAt,
			TargetID:       t.ID,
		})
	}
	appendGuideResponses(payload, views, viewerID, fulfilled)
	return payload
}

func BuildPeakDTO(db *gorm.DB, req models.PeakGuideBookingRequest, viewerID uint) map[string]any {
	peakPayload := map[string]any{
		"id":    req.PeakID,
		"naziv": "",
		"slug":  "",
	}
	if req.Peak != nil {
		peakPayload["naziv"] = req.Peak.NazivVrha
		peakPayload["slug"] = req.Peak.Slug
		peakPayload["planina"] = req.Peak.Planina
		peakPayload["drzava"] = req.Peak.Drzava
		peakPayload["grad"] = req.Peak.Grad
		peakPayload["visinaM"] = req.Peak.VisinaM
	}

	payload := map[string]any{
		"id":                req.ID,
		"peakId":            req.PeakID,
		"desiredDate":       req.DesiredDate.Format("2006-01-02"),
		"timeOfDay":         req.TimeOfDay,
		"exactTime":         req.ExactTime,
		"dateFlexible":      req.DateFlexible,
		"numberOfPeople":    req.NumberOfPeople,
		"groupExperience":   req.GroupExperience,
		"equipmentStatus":   req.EquipmentStatus,
		"contactPhone":      req.ContactPhone,
		"additionalMessage": req.AdditionalMessage,
		"skipGuides":        req.SkipGuides,
		"createdAt":         req.CreatedAt,
		"peak":              peakPayload,
		"requester":         buildRequesterPayload(db, req.Requester),
	}

	fulfilled, fulfilledActionID, fulfilledGuideName := peakFulfilledInfo(req)
	if fulfilled {
		payload["requestFulfilled"] = true
		payload["fulfilledActionId"] = fulfilledActionID
		if fulfilledGuideName != "" {
			payload["fulfilledByGuideName"] = fulfilledGuideName
		}
	} else {
		payload["requestFulfilled"] = false
	}

	views := make([]guideTargetView, 0, len(req.Targets))
	for _, t := range req.Targets {
		views = append(views, guideTargetView{
			GuideUserID:    t.GuideUserID,
			GuideProfileID: t.GuideProfileID,
			GuideName:      guideNameFromProfile(t.GuideProfile),
			Status:         t.Status,
			ActionID:       t.ActionID,
			RespondedAt:    t.RespondedAt,
			TargetID:       t.ID,
		})
	}
	appendGuideResponses(payload, views, viewerID, fulfilled)
	return payload
}
