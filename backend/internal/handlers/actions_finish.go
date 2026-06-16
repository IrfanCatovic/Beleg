package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func DodajClanaPopeoSe(c *gin.Context) {
	if !RequireAnyRole(c, "Samo admin, superadmin ili vodič može dodati člana na završenu akciju", "admin", "vodic", "superadmin") {
		return
	}

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
	if akcija.KlubID == nil || korisnik.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Možete dodati samo člana kluba koji je domaćin akcije"})
		return
	}

	var prijava models.Prijava
	err = db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijave"})
		return
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		prijava = models.Prijava{
			AkcijaID:   akcija.ID,
			KorisnikID: korisnik.ID,
			Status:     "popeo se",
		}
		if err := db.Create(&prijava).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju člana na akciju"})
			return
		}
	} else {
		if prijava.Status == "popeo se" {
			c.JSON(http.StatusConflict, gin.H{"error": "Član je već označen kao uspešno popeo se"})
			return
		}
		prijava.Status = "popeo se"
		if err := db.Save(&prijava).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju prijave"})
			return
		}
	}

	if helpers.PrijavaCountsAsClimbedPeak(db, &akcija, korisnik.ID) {
		korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
		korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
		korisnik.BrojPopeoSe += 1
		if err := db.Save(&korisnik).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
			return
		}
		notifications.NotifySummitReward(db, korisnik.ID, akcija)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Član je dodat na završenu akciju kao uspešno popeo se",
		"prijava": prijava,
	})
}

func BulkAddClubMembersCompleted(c *gin.Context) {
	if !RequireAnyRole(c, "Samo admin, superadmin ili vodič može dodati članove na završenu akciju", "admin", "vodic", "superadmin") {
		return
	}

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

	uniqueIDs := make([]uint, 0, len(req.KorisnikIDs))
	seen := make(map[uint]struct{}, len(req.KorisnikIDs))
	for _, id := range req.KorisnikIDs {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniqueIDs = append(uniqueIDs, id)
	}
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
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Članovi se ovde mogu dodati tek kada je akcija završena"})
		return
	}
	isGuideAction := strings.TrimSpace(strings.ToLower(akcija.OrganizatorTip)) == "vodic"
	if !isGuideAction && akcija.KlubID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija nema domaći klub"})
		return
	}

	var korisnici []models.Korisnik
	if err := db.Where("id IN ?", uniqueIDs).Find(&korisnici).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju korisnika"})
		return
	}
	byID := make(map[uint]models.Korisnik, len(korisnici))
	for _, korisnik := range korisnici {
		byID[korisnik.ID] = korisnik
	}

	addedCount := 0
	updatedCount := 0
	skippedCount := 0
	newlySummitedUserIDs := make([]uint, 0, len(uniqueIDs))
	perUser := make([]gin.H, 0, len(uniqueIDs))

	if err := db.Transaction(func(tx *gorm.DB) error {
		for _, korisnikID := range uniqueIDs {
			korisnik, ok := byID[korisnikID]
			if !ok {
				skippedCount++
				perUser = append(perUser, gin.H{"korisnikId": korisnikID, "status": "skipped", "reason": "korisnik nije pronađen"})
				continue
			}
			if korisnik.Role == "deleted" {
				skippedCount++
				perUser = append(perUser, gin.H{"korisnikId": korisnikID, "status": "skipped", "reason": "korisnik je deaktiviran"})
				continue
			}
			if !isGuideAction {
				if korisnik.KlubID == nil || akcija.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
					skippedCount++
					perUser = append(perUser, gin.H{"korisnikId": korisnikID, "status": "skipped", "reason": "korisnik nije član domaćeg kluba"})
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
				prijava = models.Prijava{
					AkcijaID:   akcija.ID,
					KorisnikID: korisnik.ID,
					Status:     "popeo se",
					Platio:     true,
				}
				if err := tx.Create(&prijava).Error; err != nil {
					return err
				}
				addedCount++
				newlySummited = true
				perUser = append(perUser, gin.H{"korisnikId": korisnikID, "status": "added"})
			} else {
				if prijava.Status == "popeo se" {
					skippedCount++
					perUser = append(perUser, gin.H{"korisnikId": korisnikID, "status": "skipped", "reason": "već označen kao popeo se"})
					continue
				}
				prijava.Status = "popeo se"
				prijava.Platio = true
				if err := tx.Save(&prijava).Error; err != nil {
					return err
				}
				updatedCount++
				newlySummited = true
				perUser = append(perUser, gin.H{"korisnikId": korisnikID, "status": "updated"})
			}

			if newlySummited && helpers.PrijavaCountsAsClimbedPeak(tx, &akcija, korisnik.ID) {
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
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju članova na akciju"})
		return
	}

	for _, userID := range newlySummitedUserIDs {
		notifications.NotifySummitReward(db, userID, akcija)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Obrada završena",
		"added":         addedCount,
		"updated":       updatedCount,
		"skipped":       skippedCount,
		"results":       perUser,
		"processed":     len(uniqueIDs),
		"newlySummited": len(newlySummitedUserIDs),
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

	// Nakon završetka akcije dozvoljavamo samo naknadnu potvrdu uplate (false -> true).
	// Povrat sa true -> false bi razvezao finansijsku evidenciju koja je već importovana.
	if akcija.IsCompleted && prijava.Platio && !req.Platio {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Za završenu akciju nije dozvoljeno vraćanje uplate na neplaćeno"})
		return
	}

	alreadyPaid := prijava.Platio
	if alreadyPaid == req.Platio {
		c.JSON(http.StatusOK, gin.H{
			"message": "Status uplate je ažuriran",
			"platio":  prijava.Platio,
		})
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&prijava, prijava.ID).Error; err != nil {
			return err
		}
		if prijava.Platio == req.Platio {
			return nil
		}
		prijava.Platio = req.Platio
		if err := tx.Save(&prijava).Error; err != nil {
			return err
		}

		// Ako je akcija završena i sad je član označen kao plaćen,
		// odmah upisujemo pojedinačnu uplatu u finansije (ne za privatne ture vodiča).
		if akcija.IsCompleted && !alreadyPaid && req.Platio && !akcijaSkipsClubFinances(akcija) {
			username, exists := c.Get("username")
			if !exists {
				return errors.New("Niste ulogovani")
			}
			var actor models.Korisnik
			if err := helpers.DBWhereUsername(tx, helpers.UsernameFromContext(username)).First(&actor).Error; err != nil {
				return err
			}

			var prijavaWithUser models.Prijava
			if err := tx.Preload("Korisnik").First(&prijavaWithUser, prijava.ID).Error; err != nil {
				return err
			}

			saldo := computeBaseCenaForUser(akcija, prijavaWithUser.Korisnik)
			var izbor models.PrijavaIzbori
			selSmestaj := []uint{}
			selPrevoz := []uint{}
			selRent := []prijavaRentItem{}
			if err := tx.Where("prijava_id = ?", prijava.ID).First(&izbor).Error; err == nil {
				_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
				_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
				_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
			}

			if len(selSmestaj) > 0 {
				var smestajRows []models.AkcijaSmestaj
				if err := tx.Where("akcija_id = ? AND id IN ?", akcija.ID, selSmestaj).Find(&smestajRows).Error; err == nil {
					for _, row := range smestajRows {
						saldo += row.CenaPoOsobiUkupno
					}
				}
			}
			if len(selPrevoz) > 0 {
				var prevozRows []models.AkcijaPrevoz
				if err := tx.Where("akcija_id = ? AND id IN ?", akcija.ID, selPrevoz).Find(&prevozRows).Error; err == nil {
					for _, row := range prevozRows {
						saldo += row.CenaPoOsobi
					}
				}
			}
			if len(selRent) > 0 {
				var rentRows []models.AkcijaOpremaRent
				if err := tx.Where("akcija_id = ?", akcija.ID).Find(&rentRows).Error; err == nil {
					rentByID := map[uint]float64{}
					for _, r := range rentRows {
						rentByID[r.ID] = r.CenaPoSetu
					}
					for _, item := range selRent {
						if item.Kolicina > 0 {
							saldo += rentByID[item.RentID] * float64(item.Kolicina)
						}
					}
				}
			}

			if saldo > 0 {
				recorderID := resolveFinanceRecorderID(tx, akcija.KlubID, actor.ID)
				opis := fmt.Sprintf("Prihod akcije: %s (dopuna prijava #%d)", strings.TrimSpace(akcija.Naziv), prijava.ID)

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju uplate"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Status uplate je ažuriran",
		"platio":  req.Platio,
	})
}

func ZavrsiAkciju(c *gin.Context) {
	if !RequireAnyRole(c, "Samo admin, superadmin ili vodič može završiti akciju", "admin", "vodic", "superadmin") {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	var actor models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&actor).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je završi"})
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

	const finEps = 1e-6
	importedCount := 0
	prihodUkupan := 0.0
	finansijeTip := "nista"
	netoFinansije := 0.0

	err = db.Transaction(func(tx *gorm.DB) error {
		akcija.IsCompleted = true
		if err := tx.Save(&akcija).Error; err != nil {
			return err
		}

		var prijave []models.Prijava
		if err := tx.Preload("Korisnik").
			Where("akcija_id = ? AND platio = ? AND status IN ?", akcija.ID, true, []string{"prijavljen", "popeo se", "nije uspeo"}).
			Find(&prijave).Error; err != nil {
			return err
		}

		if len(prijave) > 0 {
			var smestajRows []models.AkcijaSmestaj
			_ = tx.Where("akcija_id = ?", akcija.ID).Find(&smestajRows).Error
			smestajByID := map[uint]float64{}
			for _, s := range smestajRows {
				smestajByID[s.ID] = s.CenaPoOsobiUkupno
			}

			var prevozRows []models.AkcijaPrevoz
			_ = tx.Where("akcija_id = ?", akcija.ID).Find(&prevozRows).Error
			prevozByID := map[uint]float64{}
			for _, p := range prevozRows {
				prevozByID[p.ID] = p.CenaPoOsobi
			}

			var rentRows []models.AkcijaOpremaRent
			_ = tx.Where("akcija_id = ?", akcija.ID).Find(&rentRows).Error
			rentByID := map[uint]float64{}
			for _, r := range rentRows {
				rentByID[r.ID] = r.CenaPoSetu
			}

			for _, p := range prijave {
				saldo := computeBaseCenaForUser(akcija, p.Korisnik)
				var izbor models.PrijavaIzbori
				selSmestaj := []uint{}
				selPrevoz := []uint{}
				selRent := []prijavaRentItem{}
				if err := tx.Where("prijava_id = ?", p.ID).First(&izbor).Error; err == nil {
					_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
					_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
					_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
				}
				for _, sid := range selSmestaj {
					saldo += smestajByID[sid]
				}
				for _, pid := range selPrevoz {
					saldo += prevozByID[pid]
				}
				for _, item := range selRent {
					if item.Kolicina <= 0 {
						continue
					}
					saldo += rentByID[item.RentID] * float64(item.Kolicina)
				}
				if saldo <= 0 {
					continue
				}
				prihodUkupan += saldo
				importedCount++
			}
		}

		neto := prihodUkupan - rashodNaAkciji
		netoFinansije = neto
		if akcijaSkipsClubFinances(akcija) || math.Abs(neto) < finEps {
			return nil
		}

		recorderID := resolveFinanceRecorderID(tx, akcija.KlubID, actor.ID)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri završavanju akcije"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Akcija uspešno završena",
		"akcija":         akcija,
		"importedUplate": importedCount,
		"importedIznos":  prihodUkupan,
		"prihodUkupan":   prihodUkupan,
		"rashodNaAkciji": rashodNaAkciji,
		"netoFinansije":  netoFinansije,
		"finansijeTip":   finansijeTip,
	})
}

func DeleteAkcija(c *gin.Context) {
	if !RequireAnyRole(c, "Samo admin, superadmin ili vodič može obrisati akciju", "admin", "vodic", "superadmin") {
		return
	}

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

	var prijavaIDs []uint
	_ = db.Model(&models.Prijava{}).Where("akcija_id = ?", id).Pluck("id", &prijavaIDs).Error
	if len(prijavaIDs) > 0 {
		_ = db.Where("prijava_id IN ?", prijavaIDs).Delete(&models.PrijavaIzbori{}).Error
	}
	_ = db.Where("akcija_id = ?", id).Delete(&models.ActionParticipationRequest{}).Error
	if err := db.Where("akcija_id = ?", id).Delete(&models.Prijava{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju prijava"})
		return
	}
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaSmestaj{}).Error
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaOpremaRent{}).Error
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaOprema{}).Error
	_ = db.Where("akcija_id = ?", id).Delete(&models.AkcijaPrevoz{}).Error
	if err := db.Delete(&akcija).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju akcije"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Akcija uspešno obrisana"})
}

func OtkaziPrijavuNaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
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

	var prijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", id, korisnik.ID).First(&prijava).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Niste bili prijavljeni na ovu akciju"})
		return
	}
	if prijava.Status != "prijavljen" {
		var akcija models.Akcija
		if err := db.Select("id", "organizator_tip", "vodic_id", "is_completed").First(&akcija, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
			return
		}
		isOwnActiveGuideAction :=
			strings.TrimSpace(strings.ToLower(akcija.OrganizatorTip)) == "vodic" &&
				akcija.VodicID == korisnik.ID &&
				!akcija.IsCompleted
		if !isOwnActiveGuideAction {
			c.JSON(http.StatusForbidden, gin.H{"error": "Ne možete otkazati prijavu nakon što vam je admin potvrdio uspeh ili neuspeh"})
			return
		}
	}
	if err := db.Delete(&prijava).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju"})
		return
	}
	_ = db.Where("prijava_id = ?", prijava.ID).Delete(&models.PrijavaIzbori{}).Error
	c.JSON(http.StatusOK, gin.H{"message": "Uspešno ste otkazali prijavu"})
}

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
	if !RequireAnyRole(c, "Samo admin, superadmin ili vodič može menjati status", "admin", "vodic", "superadmin") {
		return
	}

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
	var prijava models.Prijava
	if err := db.Preload("Akcija").First(&prijava, prijavaID).Error; err != nil {
		c.JSON(404, gin.H{"error": "Prijava nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &prijava.Akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da menja status prijava"})
		return
	}

	wasPopeoSe := prijava.Status == "popeo se"
	willBePopeoSe := req.Status == "popeo se"
	countsAsPeak := helpers.PrijavaCountsAsClimbedPeak(db, &prijava.Akcija, prijava.KorisnikID)
	if wasPopeoSe != willBePopeoSe && countsAsPeak {
		var korisnik models.Korisnik
		if err := db.First(&korisnik, prijava.KorisnikID).Error; err != nil {
			c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
		if willBePopeoSe {
			korisnik.UkupnoKmKorisnik += prijava.Akcija.UkupnoKmAkcija
			korisnik.UkupnoMetaraUsponaKorisnik += prijava.Akcija.UkupnoMetaraUsponaAkcija
			korisnik.BrojPopeoSe += 1
		} else {
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
		}
		if err := db.Save(&korisnik).Error; err != nil {
			c.JSON(500, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
			return
		}
		if willBePopeoSe {
			notifications.NotifySummitReward(db, korisnik.ID, prijava.Akcija)
		}
	}

	prijava.Status = req.Status
	if err := db.Save(&prijava).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri ažuriranju statusa"})
		return
	}
	c.JSON(200, gin.H{"message": "Status ažuriran", "prijava": prijava})
}

func DeletePrijava(c *gin.Context) {
	if !RequireAnyRole(c, "Samo admin, superadmin ili vodič može da ukloni člana sa akcije", "admin", "vodic", "superadmin") {
		return
	}

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
	db.Model(&models.Prijava{}).Where("korisnik_id = ?", korisnik.ID).Pluck("akcija_id", &prijavljene)
	var otkazive []uint
	db.Table("prijave AS p").
		Joins("JOIN akcije AS a ON a.id = p.akcija_id").
		Where("p.korisnik_id = ?", korisnik.ID).
		Where(
			"p.status = ? OR (LOWER(TRIM(a.organizator_tip)) = ? AND a.vodic_id = ? AND a.is_completed = ?)",
			"prijavljen",
			"vodic",
			korisnik.ID,
			false,
		).
		Distinct().
		Pluck("p.akcija_id", &otkazive)

	c.JSON(http.StatusOK, gin.H{
		"prijavljeneAkcije": prijavljene,
		"otkaziveAkcije":    otkazive,
	})
}
