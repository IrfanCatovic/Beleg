package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/internal/services/actions"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func DodajClanaPopeoSe(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var req struct {
		KorisnikID uint `json:"korisnikId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.KorisnikID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći korisnikId"})
		return
	}

	db := DB(c)
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da dodaje članove na ovu akciju"})
		return
	}
	if akcija.IsCancelled {
		c.JSON(http.StatusConflict, gin.H{"error": helpers.ErrAkcijaCancelled.Error()})
		return
	}
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Član se ovde može dodati tek kada je akcija završena"})
		return
	}

	var korisnik models.Korisnik
	if err := db.First(&korisnik, req.KorisnikID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if korisnik.Role == "deleted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Korisnik je deaktiviran"})
		return
	}

	result, svcErr := actions.AddMemberToCompletedAction(db, &akcija, &korisnik)
	if svcErr != nil {
		switch {
		case errors.Is(svcErr, helpers.ErrAkcijaCancelled):
			c.JSON(http.StatusConflict, gin.H{"error": svcErr.Error()})
		case errors.Is(svcErr, actions.ErrMemberNotInClub):
			c.JSON(http.StatusForbidden, gin.H{"error": svcErr.Error()})
		case errors.Is(svcErr, actions.ErrMemberAlreadySummited),
			errors.Is(svcErr, helpers.ErrDuplicatePrijava):
			c.JSON(http.StatusConflict, gin.H{"error": svcErr.Error()})
		case errors.Is(svcErr, actions.ErrActionNotCompleted):
			c.JSON(http.StatusBadRequest, gin.H{"error": svcErr.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju člana na akciju"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": result.Message,
		"prijava": result.Prijava,
	})
}

func BulkAddClubMembersCompleted(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var req struct {
		KorisnikIDs []uint `json:"korisnikIds" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.KorisnikIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća lista korisnikIds"})
		return
	}

	uniqueIDs := actions.UniqueKorisnikIDs(req.KorisnikIDs)
	if len(uniqueIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lista korisnikIds je prazna"})
		return
	}

	db := DB(c)
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da dodaje članove na ovu akciju"})
		return
	}
	if akcija.IsCancelled {
		c.JSON(http.StatusConflict, gin.H{"error": helpers.ErrAkcijaCancelled.Error()})
		return
	}
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Članovi se ovde mogu dodati tek kada je akcija završena"})
		return
	}

	bulkRes, svcErr := actions.BulkAddMembersToCompletedAction(db, &akcija, req.KorisnikIDs)
	if svcErr != nil {
		if errors.Is(svcErr, helpers.ErrAkcijaCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": svcErr.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju članova na akciju"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Obrada završena",
		"added":         bulkRes.Added,
		"updated":       bulkRes.Updated,
		"skipped":       bulkRes.Skipped,
		"results":       bulkResultsAsGinH(bulkRes.Results),
		"processed":     bulkRes.Processed,
		"newlySummited": bulkRes.NewlySummited,
	})
}

func UpdatePrijavaPlatioStatus(c *gin.Context) {
	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	db := DB(c)
	var prijava models.Prijava
	if err := db.First(&prijava, prijavaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prijava nije pronađena"})
		return
	}

	var akcija models.Akcija
	if err := db.First(&akcija, prijava.AkcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	// Authorization ostaje pre-TX (postojeći P2 dug iz audita — nije u scope-u ovog fixa).
	if !helpers.CanManageAkcijaEx(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemaš pravo da menjaš status uplate"})
		return
	}
	var req struct {
		Platio bool `json:"platio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}

	var resultPlatio bool
	if err := db.Transaction(func(tx *gorm.DB) error {
		// Autoritativni redoslijed: Akcija → Prijava.
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, prijava.AkcijaID)
		if err != nil {
			return err
		}
		if lockedAkcija.IsCancelled {
			return helpers.ErrAkcijaCancelled
		}

		lockedPrijava, err := helpers.LockPrijavaForUpdate(tx, prijava.ID)
		if err != nil {
			return err
		}
		if lockedPrijava.AkcijaID != lockedAkcija.ID {
			return helpers.ErrPrijavaAkcijaMismatch
		}

		currentPaid := lockedPrijava.Platio
		requestedPaid := req.Platio
		isUnpayTransition := currentPaid && !requestedPaid
		if lockedAkcija.IsCompleted && isUnpayTransition {
			return helpers.ErrCompletedActionPaymentCannotBeUnset
		}

		resultPlatio = currentPaid
		if currentPaid == requestedPaid {
			// Idempotentno — bez Save-a.
			return nil
		}

		lockedPrijava.Platio = requestedPaid
		if err := tx.Save(lockedPrijava).Error; err != nil {
			return err
		}
		resultPlatio = requestedPaid
		akcija = *lockedAkcija
		prijava = *lockedPrijava

		// Ako je akcija završena i sad je član označen kao plaćen,
		// odmah upisujemo pojedinačnu uplatu u finansije (ne za privatne ture vodiča).
		// Koristi locked currentPaid (prije update-a), ne stale pre-read.
		if lockedAkcija.IsCompleted && !currentPaid && requestedPaid && !akcijaSkipsClubFinances(*lockedAkcija) {
			username, exists := c.Get("username")
			if !exists {
				return errors.New("Niste ulogovani")
			}
			var actor models.Korisnik
			if err := helpers.DBWhereUsername(tx, helpers.UsernameFromContext(username)).First(&actor).Error; err != nil {
				return err
			}

			var prijavaWithUser models.Prijava
			if err := tx.Preload("Korisnik").First(&prijavaWithUser, lockedPrijava.ID).Error; err != nil {
				return err
			}

			selSmestaj := []uint{}
			selPrevoz := []uint{}
			selRent := []prijavaRentItem{}
			var izbor models.PrijavaIzbori
			if err := tx.Where("prijava_id = ?", lockedPrijava.ID).First(&izbor).Error; err == nil {
				_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
				_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
				_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
			}

			saldo := computeSaldoForParticipant(tx, *lockedAkcija, prijavaWithUser.Korisnik, selSmestaj, selPrevoz, selRent)

			if saldo > 0 {
				recorderID := resolveFinanceRecorderID(tx, lockedAkcija.KlubID, actor.ID)
				opis := fmt.Sprintf("Prihod akcije: %s (dopuna prijava #%d)", strings.TrimSpace(lockedAkcija.Naziv), lockedPrijava.ID)

				var existing int64
				if err := tx.Model(&models.Transakcija{}).
					Where("tip = ? AND opis = ?", "uplata", opis).
					Count(&existing).Error; err != nil {
					return err
				}
				if existing == 0 {
					if err := tx.Create(&models.Transakcija{
						Tip:        "uplata",
						Iznos:      saldo,
						Opis:       opis,
						Datum:      time.Now(),
						KorisnikID: recorderID,
					}).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	}); err != nil {
		if errors.Is(err, helpers.ErrAkcijaCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrCompletedActionPaymentCannotBeUnset) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrPrijavaAkcijaMismatch) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Prijava ili akcija nije pronađena"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju uplate"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Status uplate je ažuriran",
		"platio":  resultPlatio,
	})
}

func ZavrsiAkciju(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	db := DB(c)
	actor, ok := AuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}

	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	roleAllowed := role == "admin" || role == "vodic" || role == "superadmin"
	canManage := helpers.CanManageAkcijaEx(c, db, &akcija)

	// #region agent log
	helpers.AgentDebugLog("actions_finish.go:ZavrsiAkciju", "finish attempt", "A", "post-fix", map[string]any{
		"actionId":       id,
		"role":           role,
		"roleAllowed":    roleAllowed,
		"canManage":      canManage,
		"organizatorTip": akcija.OrganizatorTip,
		"vodicId":        akcija.VodicID,
		"addedById":      akcija.AddedByID,
		"actorId":        actor.ID,
		"isCompleted":    akcija.IsCompleted,
	})
	// #endregion

	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da završite ovu akciju"})
		return
	}

	if akcija.IsCancelled {
		c.JSON(http.StatusConflict, gin.H{"error": helpers.ErrAkcijaCancelled.Error()})
		return
	}
	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je već završena"})
		return
	}

	var zavrsiReq struct {
		RashodNaAkciji *float64 `json:"rashodNaAkciji"`
	}
	if err := c.ShouldBindJSON(&zavrsiReq); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON (očekuje se npr. {\"rashodNaAkciji\": 0})"})
		return
	}
	rashodNaAkciji := 0.0
	if zavrsiReq.RashodNaAkciji != nil {
		rashodNaAkciji = *zavrsiReq.RashodNaAkciji
	}
	if rashodNaAkciji < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rashod na akciji ne može biti negativan"})
		return
	}

	finishRes, svcErr := actions.FinishAction(db, &akcija, actor, actions.FinishActionInput{RashodNaAkciji: rashodNaAkciji})
	if svcErr != nil {
		if errors.Is(svcErr, helpers.ErrAkcijaCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": svcErr.Error()})
			return
		}
		if errors.Is(svcErr, helpers.ErrAkcijaAlreadyComplete) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je već završena"})
			return
		}
		if errors.Is(svcErr, helpers.ErrAkcijaHasUnresolvedParticipants) {
			c.JSON(http.StatusConflict, gin.H{"error": svcErr.Error()})
			return
		}
		if errors.Is(svcErr, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri završavanju akcije"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Akcija uspešno završena",
		"akcija":         finishRes.Akcija,
		"importedUplate": finishRes.ImportedUplate,
		"importedIznos":  finishRes.ImportedIznos,
		"prihodUkupan":   finishRes.PrihodUkupan,
		"rashodNaAkciji": finishRes.RashodNaAkciji,
		"netoFinansije":  finishRes.NetoFinansije,
		"finansijeTip":   finishRes.FinansijeTip,
	})
}

func OtkaziAkciju(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	db := DB(c)
	actor, ok := AuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	var req actions.CancelActionRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON (očekuje se npr. {\"reason\": \"...\"})"})
		return
	}

	trimmed, err := actions.NormalizeCancelReason(req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Rani auth check (optimization); konačna odluka je nad zaključanom akcijom u service TX.
	var early models.Akcija
	if err := db.First(&early, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju akcije"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &early) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da otkažete ovu akciju"})
		return
	}

	result, svcErr := actions.CancelAction(db, uint(id), trimmed, actor.ID, func(tx *gorm.DB, locked *models.Akcija) error {
		if !helpers.CanManageAkcijaEx(c, tx, locked) {
			return actions.ErrCancelUnauthorized
		}
		return nil
	})
	if svcErr != nil {
		if errors.Is(svcErr, actions.ErrCancelReasonInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": svcErr.Error()})
			return
		}
		if errors.Is(svcErr, actions.ErrCancelUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da otkažete ovu akciju"})
			return
		}
		if errors.Is(svcErr, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
			return
		}
		if errors.Is(svcErr, helpers.ErrAkcijaAlreadyCancelled) ||
			errors.Is(svcErr, helpers.ErrAkcijaAlreadyComplete) ||
			errors.Is(svcErr, helpers.ErrAkcijaCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": svcErr.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju akcije"})
		return
	}

	// Best-effort fan-out nakon uspješnog commita; greške ne mijenjaju HTTP 200.
	if result != nil && result.Akcija != nil {
		notifications.NotifyActionCancelled(db, result.Akcija, result.RecipientUserIDs)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Akcija je uspešno otkazana.",
		"akcija":  result.Akcija,
	})
}

func DeleteAkcija(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je obriše"})
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return deleteAkcijaDataTx(tx, uint(id))
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
			return
		}
		if errors.Is(err, helpers.ErrAkcijaHardDeleteCancelled) ||
			errors.Is(err, helpers.ErrAkcijaHardDeleteCompleted) ||
			errors.Is(err, helpers.ErrAkcijaHardDeleteHasPrijave) ||
			errors.Is(err, helpers.ErrAkcijaHardDeleteHasSignupRequests) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju akcije"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Akcija uspešno obrisana"})
}

func OtkaziPrijavuNaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	// Preliminary read: samo id/akcija_id radi lock redoslijeda (nije autoritativan).
	var probe models.Prijava
	if err := db.Select("id", "akcija_id").
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).
		First(&probe).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Niste bili prijavljeni na ovu akciju"})
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		// Autoritativni redoslijed: Akcija → Prijava.
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, uint(akcijaID))
		if err != nil {
			return err
		}
		if lockedAkcija.IsCancelled {
			return helpers.ErrAkcijaCancelled
		}
		if lockedAkcija.IsCompleted {
			return helpers.ErrAkcijaAlreadyComplete
		}

		lockedPrijava, err := helpers.LockPrijavaForUpdate(tx, probe.ID)
		if err != nil {
			return err
		}
		if lockedPrijava.AkcijaID != lockedAkcija.ID {
			return helpers.ErrPrijavaAkcijaMismatch
		}
		if lockedPrijava.KorisnikID != korisnik.ID {
			return helpers.ErrPrijavaAkcijaMismatch
		}

		// Status guard nad locked stanjem.
		if lockedPrijava.Status != "prijavljen" {
			isOwnActiveGuideAction :=
				strings.TrimSpace(strings.ToLower(lockedAkcija.OrganizatorTip)) == "vodic" &&
					lockedAkcija.VodicID == korisnik.ID &&
					!lockedAkcija.IsCompleted &&
					!lockedAkcija.IsCancelled
			if !isOwnActiveGuideAction {
				return errSelfCancelStatusForbidden
			}
		}

		// Paid guard: samo locked Platio (ne preliminary). Prioritet: lifecycle → status → paid.
		if lockedPrijava.Platio {
			return helpers.ErrPaidPrijavaCannotBeSelfCancelled
		}

		if err := tx.Delete(lockedPrijava).Error; err != nil {
			return err
		}
		if err := tx.Where("prijava_id = ?", lockedPrijava.ID).Delete(&models.PrijavaIzbori{}).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		if errors.Is(err, helpers.ErrAkcijaCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrPrijavaAkcijaMismatch) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrPaidPrijavaCannotBeSelfCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, errSelfCancelStatusForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Niste bili prijavljeni na ovu akciju"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Uspešno ste otkazali prijavu"})
}

// errSelfCancelStatusForbidden — postojeća Forbidden poruka za nedozvoljen status self-cancela.
var errSelfCancelStatusForbidden = errors.New("Ne možete otkazati prijavu nakon što vam je admin potvrdio uspeh ili neuspeh")

func GetMojePopeoSe(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Korisnik nije pronađen", "details": err.Error()})
		return
	}

	var prijave []models.Prijava
	err := db.Where("korisnik_id = ? AND status = ?", korisnik.ID, "popeo se").Preload("Akcija").Find(&prijave).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijava", "details": err.Error()})
		return
	}

	var uspesneAkcije []models.Akcija
	var ukupnoKm float64
	var ukupnoMetaraUspona int
	var brojPopeoSe int
	for _, p := range prijave {
		if p.Akcija.ID != 0 {
			uspesneAkcije = append(uspesneAkcije, p.Akcija)
			ukupnoKm += p.Akcija.UkupnoKmAkcija
			ukupnoMetaraUspona += p.Akcija.UkupnoMetaraUsponaAkcija
			brojPopeoSe++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"uspesneAkcije": uspesneAkcije,
		"statistika": map[string]interface{}{
			"ukupnoKm":           ukupnoKm,
			"ukupnoMetaraUspona": ukupnoMetaraUspona,
			"brojPopeoSe":        brojPopeoSe,
		},
	})
}

func UpdatePrijavaStatus(c *gin.Context) {
	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći status"})
		return
	}

	log.Printf("Primljen status (raw): '%q'", req.Status)
	log.Printf("Dužina stringa: %d", len(req.Status))

	validStatuses := map[string]bool{"prijavljen": true, "popeo se": true, "nije uspeo": true, "otkazano": true}
	if !validStatuses[req.Status] {
		c.JSON(400, gin.H{"error": "Nevažeći status"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var existing models.Prijava
	if err := db.Preload("Akcija").First(&existing, prijavaID).Error; err != nil {
		c.JSON(404, gin.H{"error": "Prijava nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &existing.Akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da menja status prijava"})
		return
	}

	var outPrijava models.Prijava
	err = db.Transaction(func(tx *gorm.DB) error {
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, existing.AkcijaID)
		if err != nil {
			return err
		}
		if lockedAkcija.IsCancelled {
			return helpers.ErrAkcijaCancelled
		}
		lockedPrijava, err := helpers.LockPrijavaForUpdate(tx, existing.ID)
		if err != nil {
			return err
		}
		if lockedPrijava.AkcijaID != lockedAkcija.ID {
			return errors.New("Prijava ne pripada ovoj akciji")
		}

		wasPopeoSe := lockedPrijava.Status == "popeo se"
		willBePopeoSe := req.Status == "popeo se"
		countsAsPeak := helpers.PrijavaCountsAsClimbedPeak(tx, lockedAkcija, lockedPrijava.KorisnikID)
		if wasPopeoSe != willBePopeoSe && countsAsPeak {
			var korisnik models.Korisnik
			if err := tx.First(&korisnik, lockedPrijava.KorisnikID).Error; err != nil {
				return err
			}
			if willBePopeoSe {
				korisnik.UkupnoKmKorisnik += lockedAkcija.UkupnoKmAkcija
				korisnik.UkupnoMetaraUsponaKorisnik += lockedAkcija.UkupnoMetaraUsponaAkcija
				korisnik.BrojPopeoSe += 1
			} else {
				korisnik.UkupnoKmKorisnik -= lockedAkcija.UkupnoKmAkcija
				korisnik.UkupnoMetaraUsponaKorisnik -= lockedAkcija.UkupnoMetaraUsponaAkcija
				korisnik.BrojPopeoSe -= 1
				if korisnik.UkupnoKmKorisnik < 0 {
					korisnik.UkupnoKmKorisnik = 0
				}
				if korisnik.UkupnoMetaraUsponaKorisnik < 0 {
					korisnik.UkupnoMetaraUsponaKorisnik = 0
				}
				if korisnik.BrojPopeoSe < 0 {
					korisnik.BrojPopeoSe = 0
				}
			}
			if err := tx.Save(&korisnik).Error; err != nil {
				return err
			}
			if willBePopeoSe {
				notifications.NotifySummitReward(tx, korisnik.ID, *lockedAkcija)
			}
		}

		lockedPrijava.Status = req.Status
		if err := tx.Save(lockedPrijava).Error; err != nil {
			return err
		}
		outPrijava = *lockedPrijava
		outPrijava.Akcija = *lockedAkcija
		return nil
	})
	if err != nil {
		if errors.Is(err, helpers.ErrAkcijaCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(404, gin.H{"error": "Prijava nije pronađena"})
			return
		}
		c.JSON(500, gin.H{"error": "Greška pri ažuriranju statusa"})
		return
	}
	c.JSON(200, gin.H{"message": "Status ažuriran", "prijava": outPrijava})
}

// DeletePrijava — host uklanjanje učesnika.
// Napomena (P1 follow-up, van ovog fixa): plaćena prijava (Platio=true) i dalje može biti
// hard-delete-ovana ovdje bez paid guard-a / lock ordera; riješiti zajedno sa race-safe
// host delete flowom, ne automatski kopirati self-cancel paid pravilo bez analize.
func DeletePrijava(c *gin.Context) {
	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var prijava models.Prijava
	if err := db.Preload("Akcija").First(&prijava, prijavaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prijava nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &prijava.Akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da ukloni člana sa akcije"})
		return
	}
	if prijava.Akcija.IsCancelled {
		c.JSON(http.StatusConflict, gin.H{"error": helpers.ErrAkcijaCancelled.Error()})
		return
	}

	if prijava.Status == "popeo se" && helpers.PrijavaCountsAsClimbedPeak(db, &prijava.Akcija, prijava.KorisnikID) {
		var korisnik models.Korisnik
		if err := db.First(&korisnik, prijava.KorisnikID).Error; err == nil {
			korisnik.UkupnoKmKorisnik -= prijava.Akcija.UkupnoKmAkcija
			korisnik.UkupnoMetaraUsponaKorisnik -= prijava.Akcija.UkupnoMetaraUsponaAkcija
			korisnik.BrojPopeoSe -= 1
			if korisnik.UkupnoKmKorisnik < 0 {
				korisnik.UkupnoKmKorisnik = 0
			}
			if korisnik.UkupnoMetaraUsponaKorisnik < 0 {
				korisnik.UkupnoMetaraUsponaKorisnik = 0
			}
			if korisnik.BrojPopeoSe < 0 {
				korisnik.BrojPopeoSe = 0
			}
			db.Save(&korisnik)
		}
	}

	if err := db.Delete(&prijava).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri uklanjanju člana sa akcije"})
		return
	}
	_ = db.Where("prijava_id = ?", prijava.ID).Delete(&models.PrijavaIzbori{}).Error
	c.JSON(http.StatusOK, gin.H{"message": "Član je uklonjen sa akcije"})
}

func GetMojePrijave(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var prijavljene []uint
	db.Model(&models.Prijava{}).
		Where("korisnik_id = ? AND status = ?", korisnik.ID, "prijavljen").
		Pluck("akcija_id", &prijavljene)
	var pendingSignup []uint
	db.Model(&models.ActionSignupRequest{}).
		Where("requester_id = ? AND status = ?", korisnik.ID, models.ActionSignupRequestPending).
		Pluck("akcija_id", &pendingSignup)
	var otkazive []uint
	db.Table("prijave AS p").
		Joins("JOIN akcije AS a ON a.id = p.akcija_id").
		Where("p.korisnik_id = ?", korisnik.ID).
		Where(
			"(p.status = ? AND a.is_cancelled = ?) OR (LOWER(TRIM(a.organizator_tip)) = ? AND a.vodic_id = ? AND a.is_completed = ? AND a.is_cancelled = ?)",
			"prijavljen",
			false,
			"vodic",
			korisnik.ID,
			false,
			false,
		).
		Distinct().
		Pluck("p.akcija_id", &otkazive)

	c.JSON(http.StatusOK, gin.H{
		"prijavljeneAkcije":   prijavljene,
		"otkaziveAkcije":      otkazive,
		"pendingSignupAkcije": pendingSignup,
	})
}

func bulkResultsAsGinH(results []actions.BulkMemberUserResult) []gin.H {
	out := make([]gin.H, 0, len(results))
	for _, r := range results {
		row := gin.H{"korisnikId": r.KorisnikID, "status": r.Status}
		if r.Reason != "" {
			row["reason"] = r.Reason
		}
		out = append(out, row)
	}
	return out
}
