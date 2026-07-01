package actions

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"gorm.io/gorm"
)

type FinishActionInput struct {
	RashodNaAkciji float64
}

type FinishActionResult struct {
	Akcija         models.Akcija
	ImportedUplate int
	ImportedIznos  float64
	PrihodUkupan   float64
	RashodNaAkciji float64
	NetoFinansije  float64
	FinansijeTip   string
}

// FinishAction završava akciju i upisuje finansijski efekat u klub.
func FinishAction(db *gorm.DB, akcija *models.Akcija, actor models.Korisnik, in FinishActionInput) (*FinishActionResult, error) {
	const finEps = 1e-6
	importedCount := 0
	prihodUkupan := 0.0
	finansijeTip := "nista"
	netoFinansije := 0.0
	rashodNaAkciji := in.RashodNaAkciji

	err := db.Transaction(func(tx *gorm.DB) error {
		akcija.IsCompleted = true
		if err := tx.Save(akcija).Error; err != nil {
			return err
		}

		guidePromoted, err := helpers.PromoteGuidePrijavaToPopeoSeIfEligible(tx, akcija)
		if err != nil {
			return err
		}
		if guidePromoted {
			notifications.NotifySummitReward(tx, akcija.VodicID, *akcija)
		}

		var prijave []models.Prijava
		if err := tx.Preload("Korisnik").
			Where("akcija_id = ? AND platio = ? AND status IN ?", akcija.ID, true, []string{"prijavljen", "popeo se", "nije uspeo"}).
			Find(&prijave).Error; err != nil {
			return err
		}

		if len(prijave) > 0 {
			for _, p := range prijave {
				var izbor models.PrijavaIzbori
				selSmestaj := []uint{}
				selPrevoz := []uint{}
				selRent := []helpers.PrijavaRentItem{}
				if err := tx.Where("prijava_id = ?", p.ID).First(&izbor).Error; err == nil {
					_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
					_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
					_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
				}
				saldo := helpers.ComputeSaldoForParticipant(tx, *akcija, p.Korisnik, helpers.ParticipantChoices{
					SelectedSmestajIDs: selSmestaj,
					SelectedPrevozIDs:  selPrevoz,
					SelectedRentItems:  selRent,
				})
				if saldo <= 0 {
					continue
				}
				prihodUkupan += saldo
				importedCount++
			}
		}

		neto := prihodUkupan - rashodNaAkciji
		netoFinansije = neto
		if helpers.AkcijaSkipsClubFinances(*akcija) || math.Abs(neto) < finEps {
			return nil
		}

		recorderID := helpers.ResolveFinanceRecorderID(tx, akcija.KlubID, actor.ID)
		naziv := strings.TrimSpace(akcija.Naziv)
		if neto > finEps {
			finansijeTip = "uplata"
			return tx.Create(&models.Transakcija{
				Tip:        "uplata",
				Iznos:      neto,
				Opis:       fmt.Sprintf("Prihod sa akcije: %s", naziv),
				Datum:      time.Now(),
				KorisnikID: recorderID,
			}).Error
		}
		finansijeTip = "isplata"
		return tx.Create(&models.Transakcija{
			Tip:        "isplata",
			Iznos:      -math.Abs(neto),
			Opis:       fmt.Sprintf("Rashod sa akcije: %s", naziv),
			Datum:      time.Now(),
			KorisnikID: recorderID,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	return &FinishActionResult{
		Akcija:         *akcija,
		ImportedUplate: importedCount,
		ImportedIznos:  prihodUkupan,
		PrihodUkupan:   prihodUkupan,
		RashodNaAkciji: rashodNaAkciji,
		NetoFinansije:  netoFinansije,
		FinansijeTip:   finansijeTip,
	}, nil
}
