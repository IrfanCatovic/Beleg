package actions

import (
	"errors"
	"strings"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"gorm.io/gorm"
)

type BulkMemberUserResult struct {
	KorisnikID uint   `json:"korisnikId"`
	Status     string `json:"status"`
	Reason     string `json:"reason,omitempty"`
}

type BulkAddMembersResult struct {
	Added         int
	Updated       int
	Skipped       int
	Results       []BulkMemberUserResult
	Processed     int
	NewlySummited int
}

func UniqueKorisnikIDs(ids []uint) []uint {
	uniqueIDs := make([]uint, 0, len(ids))
	seen := make(map[uint]struct{}, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniqueIDs = append(uniqueIDs, id)
	}
	return uniqueIDs
}

// BulkAddMembersToCompletedAction dodaje više članova na završenu akciju.
func BulkAddMembersToCompletedAction(db *gorm.DB, akcija *models.Akcija, korisnikIDs []uint) (*BulkAddMembersResult, error) {
	isGuideAction := strings.TrimSpace(strings.ToLower(akcija.OrganizatorTip)) == "vodic"
	if !isGuideAction && akcija.KlubID == nil {
		return nil, errors.New("Akcija nema domaći klub")
	}

	var korisnici []models.Korisnik
	if err := db.Where("id IN ?", korisnikIDs).Find(&korisnici).Error; err != nil {
		return nil, err
	}
	byID := make(map[uint]models.Korisnik, len(korisnici))
	for _, k := range korisnici {
		byID[k.ID] = k
	}

	res := &BulkAddMembersResult{Processed: len(korisnikIDs)}
	newlySummitedUserIDs := make([]uint, 0, len(korisnikIDs))

	err := db.Transaction(func(tx *gorm.DB) error {
		for _, korisnikID := range korisnikIDs {
			korisnik, ok := byID[korisnikID]
			if !ok {
				res.Skipped++
				res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "skipped", Reason: "korisnik nije pronađen"})
				continue
			}
			if korisnik.Role == "deleted" {
				res.Skipped++
				res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "skipped", Reason: "korisnik je deaktiviran"})
				continue
			}
			if !isGuideAction {
				if korisnik.KlubID == nil || akcija.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
					res.Skipped++
					res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "skipped", Reason: "korisnik nije član domaćeg kluba"})
					continue
				}
			}

			var prijava models.Prijava
			err := tx.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			newlySummited := false
			if errors.Is(err, gorm.ErrRecordNotFound) {
				prijava = models.Prijava{AkcijaID: akcija.ID, KorisnikID: korisnik.ID, Status: "popeo se", Platio: true}
				if err := tx.Create(&prijava).Error; err != nil {
					return err
				}
				res.Added++
				newlySummited = true
				res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "added"})
			} else {
				if prijava.Status == "popeo se" {
					res.Skipped++
					res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "skipped", Reason: "već označen kao popeo se"})
					continue
				}
				prijava.Status = "popeo se"
				prijava.Platio = true
				if err := tx.Save(&prijava).Error; err != nil {
					return err
				}
				res.Updated++
				newlySummited = true
				res.Results = append(res.Results, BulkMemberUserResult{KorisnikID: korisnikID, Status: "updated"})
			}

			if newlySummited && helpers.PrijavaCountsAsClimbedPeak(tx, akcija, korisnik.ID) {
				korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
				korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
				korisnik.BrojPopeoSe += 1
				if err := tx.Model(&models.Korisnik{}).Where("id = ?", korisnik.ID).Updates(map[string]any{
					"ukupno_km_korisnik":            korisnik.UkupnoKmKorisnik,
					"ukupno_metara_uspona_korisnik": korisnik.UkupnoMetaraUsponaKorisnik,
					"broj_popeo_se":                 korisnik.BrojPopeoSe,
				}).Error; err != nil {
					return err
				}
				newlySummitedUserIDs = append(newlySummitedUserIDs, korisnik.ID)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	for _, userID := range newlySummitedUserIDs {
		notifications.NotifySummitReward(db, userID, *akcija)
	}
	res.NewlySummited = len(newlySummitedUserIDs)
	return res, nil
}
