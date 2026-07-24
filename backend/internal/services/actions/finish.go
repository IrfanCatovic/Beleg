package actions

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
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

// SummitRewardNotification — post-commit fan-out za korisnika koji je u FinishAction
// stvarno dobio summit reward domain efekat (trenutno: guide auto-promote).
type SummitRewardNotification struct {
	RecipientUserID uint
}

type FinishActionResult struct {
	Akcija                    models.Akcija
	ImportedUplate            int
	ImportedIznos             float64
	PrihodUkupan              float64
	RashodNaAkciji            float64
	NetoFinansije             float64
	FinansijeTip              string
	SummitRewardNotifications []SummitRewardNotification
}

// summitRewardNotify je post-commit helper; testovi mogu override-ovati.
var summitRewardNotify = func(db *gorm.DB, userID uint, akcija models.Akcija) {
	notifications.NotifySummitReward(db, userID, akcija)
}

func notifySummitRewardsBestEffort(db *gorm.DB, akcija models.Akcija, items []SummitRewardNotification) {
	if len(items) == 0 {
		return
	}
	// Deduplikacija po recipientu (jedan notification po useru i akciji).
	seen := make(map[uint]struct{}, len(items))
	recipients := make([]uint, 0, len(items))
	for _, it := range items {
		if it.RecipientUserID == 0 {
			continue
		}
		if _, ok := seen[it.RecipientUserID]; ok {
			continue
		}
		seen[it.RecipientUserID] = struct{}{}
		recipients = append(recipients, it.RecipientUserID)
	}
	sort.Slice(recipients, func(i, j int) bool { return recipients[i] < recipients[j] })

	defer func() {
		if r := recover(); r != nil {
			log.Printf(
				"summit reward notify panic phase=notify akcijaId=%d recipientCount=%d: %v",
				akcija.ID, len(recipients), r,
			)
		}
	}()

	for _, uid := range recipients {
		func(userID uint) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf(
						"summit reward notify panic phase=notify akcijaId=%d recipientUserId=%d: %v",
						akcija.ID, userID, r,
					)
				}
			}()
			summitRewardNotify(db, userID, akcija)
		}(uid)
	}
}

// FinishAction završava akciju i upisuje finansijski efekat u klub.
// Redoslijed: lock Akcija → cancel pending signup → revoke invites → lock Prijava
// → guide promote → unresolved guard → IsCompleted → finansije → commit
// → summit reward notification (best-effort).
func FinishAction(db *gorm.DB, akcija *models.Akcija, actor models.Korisnik, in FinishActionInput) (*FinishActionResult, error) {
	const finEps = 1e-6
	importedCount := 0
	prihodUkupan := 0.0
	finansijeTip := "nista"
	netoFinansije := 0.0
	rashodNaAkciji := in.RashodNaAkciji
	var summitNotifs []SummitRewardNotification

	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := helpers.LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		if locked.IsCancelled {
			return helpers.ErrAkcijaCancelled
		}
		if locked.IsCompleted {
			return helpers.ErrAkcijaAlreadyComplete
		}
		*akcija = *locked

		finishedAt := time.Now()

		if _, err := helpers.CancelPendingSignupRequestsForActionTx(tx, akcija.ID, finishedAt); err != nil {
			return err
		}
		if _, err := helpers.RevokeActiveActionInviteLinksTx(tx, akcija.ID, finishedAt); err != nil {
			return err
		}

		if _, err := helpers.LockPrijaveForAkcijaForUpdate(tx, akcija.ID); err != nil {
			return err
		}

		// Variant A: vodič klupske ture se prvo auto-promoviše, pa se provjeravaju preostali prijavljen.
		guidePromoted, err := helpers.PromoteGuidePrijavaToPopeoSeIfEligible(tx, akcija)
		if err != nil {
			return err
		}

		if err := helpers.EnsureNoUnresolvedParticipantResultsTx(tx, akcija.ID); err != nil {
			return err
		}

		akcija.IsCompleted = true
		if err := tx.Save(akcija).Error; err != nil {
			return err
		}

		// Snapshot samo kada je reward domain efekat stvarno izvršen u ovoj TX.
		if guidePromoted && akcija.VodicID != 0 {
			summitNotifs = append(summitNotifs, SummitRewardNotification{RecipientUserID: akcija.VodicID})
		}

		var prijave []models.Prijava
		if err := tx.Preload("Korisnik").
			Where("akcija_id = ? AND platio = ? AND status IN ?", akcija.ID, true, helpers.PrijavaActiveStatuses).
			Order("id").
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
				Datum:      finishedAt,
				KorisnikID: recorderID,
			}).Error
		}
		finansijeTip = "isplata"
		return tx.Create(&models.Transakcija{
			Tip:        "isplata",
			Iznos:      -math.Abs(neto),
			Opis:       fmt.Sprintf("Rashod sa akcije: %s", naziv),
			Datum:      finishedAt,
			KorisnikID: recorderID,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	notifySummitRewardsBestEffort(db, *akcija, summitNotifs)

	return &FinishActionResult{
		Akcija:                    *akcija,
		ImportedUplate:            importedCount,
		ImportedIznos:             prihodUkupan,
		PrihodUkupan:              prihodUkupan,
		RashodNaAkciji:            rashodNaAkciji,
		NetoFinansije:             netoFinansije,
		FinansijeTip:              finansijeTip,
		SummitRewardNotifications: summitNotifs,
	}, nil
}
