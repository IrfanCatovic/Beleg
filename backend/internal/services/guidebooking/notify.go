package guidebooking

import (
	"encoding/json"
	"strings"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"gorm.io/gorm"
)

func NotifyFerrataTargets(db *gorm.DB, req models.FerrataGuideBookingRequest, targets []models.FerrataGuideBookingTarget) {
	requesterName := displayName(req.Requester.FullName, req.Requester.Username, "Korisnik")
	ferrataName := ferrataDisplayName(req.Ferrata)
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Imate novi zahtev za akciju"
	body := requesterName + " traži vođenje na ferati \"" + ferrataName + "\" za datum " + dateStr + "."

	metaBase := map[string]any{
		"bookingKind":        "ferrata",
		"bookingRequestId":   req.ID,
		"ferrataId":          req.FerrataID,
		"ferrataNaziv":       ferrataName,
		"requesterId":        req.RequesterID,
		"requesterUsername":  req.Requester.Username,
		"requesterFullName":  req.Requester.FullName,
		"desiredDate":        req.DesiredDate.Format("2006-01-02"),
		"numberOfPeople":     req.NumberOfPeople,
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
		"bookingKind":        "peak",
		"bookingRequestId":   req.ID,
		"peakId":             req.PeakID,
		"peakNaziv":          peakName,
		"requesterId":        req.RequesterID,
		"requesterUsername":  req.Requester.Username,
		"requesterFullName":  req.Requester.FullName,
		"desiredDate":        req.DesiredDate.Format("2006-01-02"),
		"numberOfPeople":     req.NumberOfPeople,
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

func NotifyFerrataRequesterRejected(db *gorm.DB, req models.FerrataGuideBookingRequest, target models.FerrataGuideBookingTarget, guide models.Korisnik) {
	guideName := displayName(guide.FullName, guide.Username, "Vodič")
	ferrataName := ferrataDisplayName(req.Ferrata)
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Zahtev za vođenje je odbijen"
	body := guideName + " je odbio zahtev za vođenje na ferati \"" + ferrataName + "\" za datum " + dateStr + "."
	meta := map[string]any{
		"bookingKind":      "ferrata",
		"bookingRequestId": req.ID,
		"ferrataId":        req.FerrataID,
		"ferrataNaziv":     ferrataName,
		"guideUserId":      target.GuideUserID,
		"status":           models.GuideBookingTargetStatusRejected,
	}
	metaBytes, _ := json.Marshal(meta)
	notifications.NotifyUsers(db, []uint{req.RequesterID}, models.ObavestenjeTipGuideBookingRequest, title, body, "", string(metaBytes))
}

func NotifyFerrataRequesterFulfilled(db *gorm.DB, req models.FerrataGuideBookingRequest, guide models.Korisnik, actionID uint) {
	guideName := displayName(guide.FullName, guide.Username, "Vodič")
	ferrataName := ferrataDisplayName(req.Ferrata)
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Akcija je kreirana za vaš zahtev"
	body := guideName + " je kreirao akciju za vođenje na ferati \"" + ferrataName + "\" za datum " + dateStr + "."
	meta := map[string]any{
		"bookingKind":      "ferrata",
		"bookingRequestId": req.ID,
		"ferrataId":        req.FerrataID,
		"ferrataNaziv":     ferrataName,
		"guideUserId":      guide.ID,
		"actionId":         actionID,
		"status":           models.GuideBookingTargetStatusAccepted,
	}
	metaBytes, _ := json.Marshal(meta)
	notifications.NotifyUsers(db, []uint{req.RequesterID}, models.ObavestenjeTipGuideBookingRequest, title, body, "", string(metaBytes))
}

func NotifyPeakRequesterRejected(db *gorm.DB, req models.PeakGuideBookingRequest, target models.PeakGuideBookingTarget, guide models.Korisnik) {
	guideName := displayName(guide.FullName, guide.Username, "Vodič")
	peakName := peakDisplayName(req.Peak)
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Zahtev za vođenje je odbijen"
	body := guideName + " je odbio zahtev za vođenje na vrh \"" + peakName + "\" za datum " + dateStr + "."
	meta := map[string]any{
		"bookingKind":      "peak",
		"bookingRequestId": req.ID,
		"peakId":           req.PeakID,
		"peakNaziv":        peakName,
		"guideUserId":      target.GuideUserID,
		"status":           models.GuideBookingTargetStatusRejected,
	}
	metaBytes, _ := json.Marshal(meta)
	notifications.NotifyUsers(db, []uint{req.RequesterID}, models.ObavestenjeTipGuideBookingRequest, title, body, "", string(metaBytes))
}

func NotifyPeakRequesterFulfilled(db *gorm.DB, req models.PeakGuideBookingRequest, guide models.Korisnik, actionID uint) {
	guideName := displayName(guide.FullName, guide.Username, "Vodič")
	peakName := peakDisplayName(req.Peak)
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Akcija je kreirana za vaš zahtev"
	body := guideName + " je kreirao akciju za vođenje na vrh \"" + peakName + "\" za datum " + dateStr + "."
	meta := map[string]any{
		"bookingKind":      "peak",
		"bookingRequestId": req.ID,
		"peakId":           req.PeakID,
		"peakNaziv":        peakName,
		"guideUserId":      guide.ID,
		"actionId":         actionID,
		"status":           models.GuideBookingTargetStatusAccepted,
	}
	metaBytes, _ := json.Marshal(meta)
	notifications.NotifyUsers(db, []uint{req.RequesterID}, models.ObavestenjeTipGuideBookingRequest, title, body, "", string(metaBytes))
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

func ferrataDisplayName(ferrata *models.Ferrata) string {
	if ferrata == nil {
		return "feratu"
	}
	if n := strings.TrimSpace(ferrata.Naziv); n != "" {
		return n
	}
	return "feratu"
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
