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

// AkcijaCountsAsGuidedTourForVodic — završena akcija koju je korisnik vodio (PER iz vođenih tura).
func AkcijaCountsAsGuidedTourForVodic(db *gorm.DB, akcija *models.Akcija, korisnikID uint) bool {
	if akcija == nil || !akcija.IsCompleted || korisnikID == 0 || akcija.VodicID != korisnikID {
		return false
	}
	return true
}

// PrijavaCountsAsClimbedPeak — da li uspešna prijava ulazi u osvojene vrhove / statistiku uspona.
func PrijavaCountsAsClimbedPeak(db *gorm.DB, akcija *models.Akcija, korisnikID uint) bool {
	if akcija == nil || akcija.ID == 0 {
		return true
	}
	return !AkcijaProfiGuideAsLeader(db, akcija, korisnikID)
}

// PromoteGuidePrijavaToPopeoSeIfEligible — pri završetku akcije vodič klupske ture dobija „popeo se“ za PER/statistiku.
func PromoteGuidePrijavaToPopeoSeIfEligible(tx *gorm.DB, akcija *models.Akcija) (bool, error) {
	if akcija == nil || akcija.VodicID == 0 {
		return false, nil
	}
	var prijava models.Prijava
	if err := tx.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, akcija.VodicID).First(&prijava).Error; err != nil {
		return false, nil
	}
	if prijava.Status != PrijavaStatusPrijavljen {
		return false, nil
	}
	if !PrijavaCountsAsClimbedPeak(tx, akcija, akcija.VodicID) {
		return false, nil
	}
	var korisnik models.Korisnik
	if err := tx.First(&korisnik, akcija.VodicID).Error; err != nil {
		return false, err
	}
	prijava.Status = "popeo se"
	if err := tx.Save(&prijava).Error; err != nil {
		return false, err
	}
	korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
	korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
	korisnik.BrojPopeoSe += 1
	if err := tx.Save(&korisnik).Error; err != nil {
		return false, err
	}
	return true, nil
}
