package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func mapPrevozLifecycleError(c *gin.Context, err error) bool {
	if errors.Is(err, helpers.ErrAkcijaCancelled) {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return true
	}
	if errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return true
	}
	return false
}

func canAddPrevozOnLockedAction(c *gin.Context, tx *gorm.DB, locked *models.Akcija, actorID uint) (bool, error) {
	if helpers.CanManageAkcijaEx(c, tx, locked) {
		return true, nil
	}
	var count int64
	if err := tx.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ? AND status = ?", locked.ID, actorID, "prijavljen").
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

var errPrevozAddForbidden = errors.New("Samo prijavljeni članovi mogu dodati novi prevoz")
var errPrevozDeleteForbidden = errors.New("Samo organizator kluba može obrisati prevoz")

// DodajPrevozZaAkciju — čisti insert nove prevoz opcije (nije upsert).
// Lock: Akcija → (opciono Prijava → PrijavaIzbori pri join).
func DodajPrevozZaAkciju(c *gin.Context) {
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
	db := DB(c)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var req struct {
		TipPrevoza  string  `json:"tipPrevoza"`
		NazivGrupe  string  `json:"nazivGrupe"`
		Kapacitet   int     `json:"kapacitet"`
		CenaPoOsobi float64 `json:"cenaPoOsobi"`
		Join        bool    `json:"join"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}
	naziv := strings.TrimSpace(req.NazivGrupe)
	tip := strings.TrimSpace(req.TipPrevoza)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv grupe je obavezan"})
		return
	}
	if tip == "" {
		tip = "auto"
	}
	if req.Kapacitet < 1 || req.Kapacitet > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kapacitet mora biti između 1 i 50"})
		return
	}
	if req.CenaPoOsobi < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cena ne sme biti negativna"})
		return
	}

	var row models.AkcijaPrevoz
	if err := db.Transaction(func(tx *gorm.DB) error {
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, uint(akcijaID))
		if err != nil {
			return err
		}
		if err := helpers.ValidateAkcijaActive(lockedAkcija); err != nil {
			return err
		}
		allowed, err := canAddPrevozOnLockedAction(c, tx, lockedAkcija, korisnik.ID)
		if err != nil {
			return err
		}
		if !allowed {
			return errPrevozAddForbidden
		}

		row = models.AkcijaPrevoz{
			AkcijaID:    lockedAkcija.ID,
			TipPrevoza:  tip,
			NazivGrupe:  naziv,
			Kapacitet:   req.Kapacitet,
			CenaPoOsobi: req.CenaPoOsobi,
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}

		if !req.Join {
			// Čisti insert bez postojećih izbora — nema Platio resetovanja.
			return nil
		}

		var prijava models.Prijava
		if err := tx.Where("akcija_id = ? AND korisnik_id = ?", lockedAkcija.ID, korisnik.ID).First(&prijava).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		lockedPrijava, err := helpers.LockPrijavaForUpdate(tx, prijava.ID)
		if err != nil {
			return err
		}
		if lockedPrijava.AkcijaID != lockedAkcija.ID || lockedPrijava.KorisnikID != korisnik.ID {
			return helpers.ErrPrijavaAkcijaMismatch
		}

		var beforeChoices helpers.ParticipantChoices
		lockedIzbor, izborErr := helpers.LockPrijavaIzboriForUpdate(tx, lockedPrijava.ID)
		if izborErr == nil {
			beforeChoices, err = helpers.ParticipantChoicesFromIzbori(lockedIzbor)
			if err != nil {
				return err
			}
		} else if !errors.Is(izborErr, gorm.ErrRecordNotFound) {
			return izborErr
		} else {
			lockedIzbor = nil
		}

		afterChoices := beforeChoices
		afterChoices.SelectedPrevozIDs = append(append([]uint(nil), beforeChoices.SelectedPrevozIDs...), row.ID)

		smJSON, _ := json.Marshal(afterChoices.SelectedSmestajIDs)
		prJSON, _ := json.Marshal(afterChoices.SelectedPrevozIDs)
		reJSON, _ := json.Marshal(afterChoices.SelectedRentItems)

		if lockedIzbor == nil {
			izbor := models.PrijavaIzbori{
				PrijavaID:            lockedPrijava.ID,
				SelectedSmestajIDs:   string(smJSON),
				SelectedPrevozIDs:    string(prJSON),
				SelectedRentItemsRaw: string(reJSON),
			}
			if err := tx.Create(&izbor).Error; err != nil {
				return err
			}
		} else {
			lockedIzbor.SelectedPrevozIDs = string(prJSON)
			if err := tx.Save(lockedIzbor).Error; err != nil {
				return err
			}
		}

		return helpers.UnsetPlatioIfObligationChangedTx(tx, *lockedAkcija, lockedPrijava, korisnik, beforeChoices, afterChoices)
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
			return
		}
		if errors.Is(err, errPrevozAddForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if mapPrevozLifecycleError(c, err) {
			return
		}
		if errors.Is(err, helpers.ErrPrijavaAkcijaMismatch) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju prevoza"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Prevoz dodat", "prevoz": row})
}

// ObrisiPrevozZaAkciju — host brisanje prevoz opcije sa strip izbora i Platio delta resetom.
// Lock: Akcija → Prevoz → pogođene Prijave → PrijavaIzbori.
func ObrisiPrevozZaAkciju(c *gin.Context) {
	akcijaID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	prevozID64, err := strconv.ParseUint(strings.TrimSpace(c.Param("prevozId")), 10, 32)
	if err != nil || prevozID64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prevoza"})
		return
	}
	prevozID := uint(prevozID64)

	db := DB(c)

	if err := db.Transaction(func(tx *gorm.DB) error {
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, uint(akcijaID))
		if err != nil {
			return err
		}
		if !helpers.CanManageAkcijaEx(c, tx, lockedAkcija) {
			return errPrevozDeleteForbidden
		}
		if err := helpers.ValidateAkcijaActive(lockedAkcija); err != nil {
			return err
		}

		var prev models.AkcijaPrevoz
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND akcija_id = ?", prevozID, lockedAkcija.ID).
			First(&prev).Error; err != nil {
			return err
		}
		if prev.AkcijaID != lockedAkcija.ID {
			return helpers.ErrPrijavaAkcijaMismatch
		}

		affected, err := findPrijaveSelectingPrevozTx(tx, lockedAkcija.ID, prevozID)
		if err != nil {
			return err
		}

		type affectedState struct {
			prijava     *models.Prijava
			korisnik    models.Korisnik
			before      helpers.ParticipantChoices
			beforeSaldo float64
			izbor       *models.PrijavaIzbori
		}
		states := make([]affectedState, 0, len(affected))

		for _, p := range affected {
			lockedPrijava, err := helpers.LockPrijavaForUpdate(tx, p.ID)
			if err != nil {
				return err
			}
			if lockedPrijava.AkcijaID != lockedAkcija.ID {
				return helpers.ErrPrijavaAkcijaMismatch
			}
			lockedIzbor, err := helpers.LockPrijavaIzboriForUpdate(tx, lockedPrijava.ID)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					continue
				}
				return err
			}
			before, err := helpers.ParticipantChoicesFromIzbori(lockedIzbor)
			if err != nil {
				return err
			}
			if !helpers.ChoiceIDsContain(before.SelectedPrevozIDs, prevozID) {
				continue
			}
			var korisnik models.Korisnik
			if err := tx.First(&korisnik, lockedPrijava.KorisnikID).Error; err != nil {
				return err
			}
			// Before saldo dok prevoz red još postoji (kalkulator čita cijene iz DB).
			beforeSaldo := helpers.ComputeSaldoForParticipant(tx, *lockedAkcija, korisnik, before)
			states = append(states, affectedState{
				prijava:     lockedPrijava,
				korisnik:    korisnik,
				before:      before,
				beforeSaldo: beforeSaldo,
				izbor:       lockedIzbor,
			})
		}

		for _, st := range states {
			newSel, removed := helpers.RemoveChoiceID(st.before.SelectedPrevozIDs, prevozID)
			if !removed {
				continue
			}
			prJSON, _ := json.Marshal(newSel)
			st.izbor.SelectedPrevozIDs = string(prJSON)
			if err := tx.Save(st.izbor).Error; err != nil {
				return err
			}
		}

		if err := tx.Delete(&models.AkcijaPrevoz{}, prev.ID).Error; err != nil {
			return err
		}

		for _, st := range states {
			after, err := helpers.ParticipantChoicesFromIzbori(st.izbor)
			if err != nil {
				return err
			}
			if !containsActivePrijavaStatus(st.prijava.Status) || !st.prijava.Platio {
				continue
			}
			afterSaldo := helpers.ComputeSaldoForParticipant(tx, *lockedAkcija, st.korisnik, after)
			if helpers.SaldoAmountsEqual(st.beforeSaldo, afterSaldo) {
				continue
			}
			if err := tx.Model(st.prijava).Update("platio", false).Error; err != nil {
				return err
			}
			st.prijava.Platio = false
		}
		return nil
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			var akcija models.Akcija
			if db.First(&akcija, akcijaID).Error != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
				return
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "Prevoz nije pronađen"})
			return
		}
		if errors.Is(err, errPrevozDeleteForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if mapPrevozLifecycleError(c, err) {
			return
		}
		if errors.Is(err, helpers.ErrPrijavaAkcijaMismatch) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju prevoza"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Prevoz obrisan"})
}

func containsActivePrijavaStatus(status string) bool {
	for _, s := range helpers.PrijavaActiveStatuses {
		if s == status {
			return true
		}
	}
	return false
}

// findPrijaveSelectingPrevozTx vraća prijave akcije (ORDER BY id) koje u izborima imaju prevozID.
func findPrijaveSelectingPrevozTx(tx *gorm.DB, akcijaID, prevozID uint) ([]models.Prijava, error) {
	var prijave []models.Prijava
	if err := tx.Where("akcija_id = ?", akcijaID).Order("id").Find(&prijave).Error; err != nil {
		return nil, err
	}
	out := make([]models.Prijava, 0)
	for _, p := range prijave {
		var izbor models.PrijavaIzbori
		if err := tx.Where("prijava_id = ?", p.ID).First(&izbor).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return nil, err
		}
		choices, err := helpers.ParticipantChoicesFromIzbori(&izbor)
		if err != nil {
			return nil, err
		}
		if helpers.ChoiceIDsContain(choices.SelectedPrevozIDs, prevozID) {
			out = append(out, p)
		}
	}
	return out, nil
}

func GetPrevozPrijave(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	db := DB(c)
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}

	canSee := false
	if akcija.PrikaziListuPrijavljenih && akcija.Javna {
		canSee = true
	} else if akcija.KlubID != nil {
		if viewerClubID, ok := helpers.GetEffectiveClubID(c, db); ok && viewerClubID == *akcija.KlubID {
			canSee = true
		}
	}
	if !canSee {
		canSee = helpers.CanManageAkcijaEx(c, db, &akcija)
	}
	if !canSee {
		c.JSON(http.StatusForbidden, gin.H{"error": "Spisak prevoza nije dostupan"})
		return
	}

	var prijave []models.Prijava
	_ = db.Preload("Korisnik").Where("akcija_id = ? AND status IN ?", akcija.ID, []string{"prijavljen", "popeo se", "nije uspeo"}).Find(&prijave).Error
	prevozMap := map[uint][]gin.H{}
	for _, p := range prijave {
		var izbor models.PrijavaIzbori
		if err := db.Where("prijava_id = ?", p.ID).First(&izbor).Error; err != nil {
			continue
		}
		var selPrevoz []uint
		_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
		for _, pid := range selPrevoz {
			prevozMap[pid] = append(prevozMap[pid], gin.H{
				"prijavaId": p.ID,
				"korisnik":  p.Korisnik.Username,
				"fullName":  p.Korisnik.FullName,
				"avatarUrl": p.Korisnik.AvatarURL,
			})
		}
	}
	c.JSON(200, gin.H{"prevozPrijave": prevozMap})
}
