package helpers

import (
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// AkcijaProfiGuideAsLeader — vodič je dodeljen na akciju kao verifikovani profi vodič (ne klubski vodič domaćina).
// Takve akcije ulaze u „vođene ture“, a ne u osvojene vrhove za tog vodiča.
func AkcijaProfiGuideAsLeader(db *gorm.DB, akcija *models.Akcija, korisnikID uint) bool {
	if akcija == nil || korisnikID == 0 || akcija.VodicID != korisnikID {
		return false
	}
	if !KorisnikIsApprovedProfiGuide(db, korisnikID) {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(akcija.OrganizatorTip), "vodic") {
		return true
	}
	var k models.Korisnik
	if err := db.Select("id", "role", "klub_id").First(&k, korisnikID).Error; err != nil {
		return false
	}
	if k.Role == "vodic" && akcija.KlubID != nil && k.KlubID != nil && *k.KlubID == *akcija.KlubID {
		return false
	}
	return true
}

// AkcijaCountsAsGuidedTourForVodic — završena akcija u sekciji vođenih tura na profilu profi vodiča.
func AkcijaCountsAsGuidedTourForVodic(db *gorm.DB, akcija *models.Akcija, korisnikID uint) bool {
	if akcija == nil || !akcija.IsCompleted || korisnikID == 0 || akcija.VodicID != korisnikID {
		return false
	}
	return AkcijaProfiGuideAsLeader(db, akcija, korisnikID)
}

// PrijavaCountsAsClimbedPeak — da li uspešna prijava ulazi u osvojene vrhove / statistiku uspona.
func PrijavaCountsAsClimbedPeak(db *gorm.DB, akcija *models.Akcija, korisnikID uint) bool {
	if akcija == nil || akcija.ID == 0 {
		return true
	}
	return !AkcijaProfiGuideAsLeader(db, akcija, korisnikID)
}
