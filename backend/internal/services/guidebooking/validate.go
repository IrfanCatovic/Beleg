package guidebooking

import (
	"strings"
	"time"
)

type CreateBookingInput struct {
	DesiredDate       string
	TimeOfDay         string
	ExactTime         string
	DateFlexible      bool
	NumberOfPeople    int
	GroupExperience   string
	EquipmentStatus   string
	ContactPhone      string
	AdditionalMessage string
	GuideProfileIDs   []uint
	SkipGuides        bool
}

var (
	AllowedTimeOfDay = map[string]bool{
		"morning": true, "afternoon": true, "any": true, "exact": true,
	}
	AllowedExperience = map[string]bool{
		"beginners": true, "recreational": true, "experienced": true, "mixed": true,
	}
	AllowedEquipment = map[string]bool{
		"complete": true, "none": true, "partial": true, "unsure": true,
	}
)

// ValidateCreateBooking parsira i validira zajednička polja guide booking zahteva.
func ValidateCreateBooking(in CreateBookingInput) (desiredDate time.Time, timeOfDay, groupExp, equip, phone string, errMsg string) {
	desiredDate, err := time.Parse("2006-01-02", strings.TrimSpace(in.DesiredDate))
	if err != nil {
		return time.Time{}, "", "", "", "", "Neispravan datum."
	}
	timeOfDay = strings.TrimSpace(in.TimeOfDay)
	if !AllowedTimeOfDay[timeOfDay] {
		return time.Time{}, "", "", "", "", "Neispravno vreme / deo dana."
	}
	if timeOfDay == "exact" && strings.TrimSpace(in.ExactTime) == "" {
		return time.Time{}, "", "", "", "", "Unesite tačno vreme."
	}
	if in.NumberOfPeople < 1 {
		return time.Time{}, "", "", "", "", "Broj osoba mora biti najmanje 1."
	}
	groupExp = strings.TrimSpace(in.GroupExperience)
	if !AllowedExperience[groupExp] {
		return time.Time{}, "", "", "", "", "Izaberite iskustvo grupe."
	}
	equip = strings.TrimSpace(in.EquipmentStatus)
	if !AllowedEquipment[equip] {
		return time.Time{}, "", "", "", "", "Izaberite status opreme."
	}
	phone = strings.TrimSpace(in.ContactPhone)
	if phone == "" {
		return time.Time{}, "", "", "", "", "Kontakt telefon je obavezan."
	}
	return desiredDate, timeOfDay, groupExp, equip, phone, ""
}

func UniqueUints(in []uint) []uint {
	seen := make(map[uint]struct{}, len(in))
	out := make([]uint, 0, len(in))
	for _, id := range in {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func ValidateGuideTargets(skipGuides bool, guideIDs []uint) string {
	if skipGuides {
		return ""
	}
	if len(guideIDs) == 0 {
		return "Izaberite bar jednog vodiča ili označite da vam vodič nije potreban."
	}
	return ""
}
