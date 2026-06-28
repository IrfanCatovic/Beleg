package helpers

import (
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// ApprovedProfiGuideKorisnikIDs vraća skup korisnik_id sa odobrenim guide_profiles.
func ApprovedProfiGuideKorisnikIDs(db *gorm.DB, korisnikIDs []uint) map[uint]bool {
	out := make(map[uint]bool)
	if len(korisnikIDs) == 0 {
		return out
	}
	uniq := make([]uint, 0, len(korisnikIDs))
	seen := make(map[uint]struct{}, len(korisnikIDs))
	for _, id := range korisnikIDs {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniq = append(uniq, id)
	}
	if len(uniq) == 0 {
		return out
	}
	var ids []uint
	if err := db.Model(&models.GuideProfile{}).
		Where("korisnik_id IN ? AND status = ?", uniq, models.GuideStatusApproved).
		Pluck("korisnik_id", &ids).Error; err != nil {
		return out
	}
	for _, id := range ids {
		out[id] = true
	}
	return out
}

func KorisnikIsApprovedProfiGuide(db *gorm.DB, korisnikID uint) bool {
	if korisnikID == 0 {
		return false
	}
	return ApprovedProfiGuideKorisnikIDs(db, []uint{korisnikID})[korisnikID]
}

// VodicCanReceiveGuideRatings — ocene posle akcije samo za odobrene profi vodiče.
func VodicCanReceiveGuideRatings(db *gorm.DB, vodicID uint) bool {
	return vodicID > 0 && KorisnikIsApprovedProfiGuide(db, vodicID)
}

// ApplyProfiGuideFlagsToKorisnici postavlja IsProfiGuide na slice (gorm:"-" polje).
func ApplyProfiGuideFlagsToKorisnici(db *gorm.DB, rows []models.Korisnik) {
	if len(rows) == 0 {
		return
	}
	ids := make([]uint, len(rows))
	for i := range rows {
		ids[i] = rows[i].ID
	}
	set := ApprovedProfiGuideKorisnikIDs(db, ids)
	for i := range rows {
		rows[i].IsProfiGuide = set[rows[i].ID]
	}
}
