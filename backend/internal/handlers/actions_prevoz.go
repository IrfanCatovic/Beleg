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
)

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
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je završena"})
		return
	}
	isHost := helpers.CanManageAkcijaEx(c, db, &akcija)
	if !isHost {
		var count int64
		db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ? AND status = ?", akcija.ID, korisnik.ID, "prijavljen").Count(&count)
		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Samo prijavljeni članovi mogu dodati novi prevoz"})
			return
		}
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
	row := models.AkcijaPrevoz{
		AkcijaID:    akcija.ID,
		TipPrevoza:  tip,
		NazivGrupe:  naziv,
		Kapacitet:   req.Kapacitet,
		CenaPoOsobi: req.CenaPoOsobi,
	}
	if err := db.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju prevoza"})
		return
	}

	if req.Join {
		var prijava models.Prijava
		if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error; err == nil {
			var izbor models.PrijavaIzbori
			selSmestaj := []uint{}
			selPrevoz := []uint{}
			selRent := []prijavaRentItem{}
			if err := db.Where("prijava_id = ?", prijava.ID).First(&izbor).Error; err == nil {
				_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &selSmestaj)
				_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &selPrevoz)
				_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &selRent)
			}
			selPrevoz = append(selPrevoz, row.ID)
			smJSON, _ := json.Marshal(selSmestaj)
			prJSON, _ := json.Marshal(selPrevoz)
			reJSON, _ := json.Marshal(selRent)
			if izbor.ID == 0 {
				izbor = models.PrijavaIzbori{
					PrijavaID:            prijava.ID,
					SelectedSmestajIDs:   string(smJSON),
					SelectedPrevozIDs:    string(prJSON),
					SelectedRentItemsRaw: string(reJSON),
				}
				_ = db.Create(&izbor).Error
			} else {
				izbor.SelectedPrevozIDs = string(prJSON)
				_ = db.Save(&izbor).Error
			}
		}
	}
	c.JSON(200, gin.H{"message": "Prevoz dodat", "prevoz": row})
}

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

	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba može obrisati prevoz"})
		return
	}
	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je završena"})
		return
	}

	var prev models.AkcijaPrevoz
	if err := db.Where("id = ? AND akcija_id = ?", prevozID, akcija.ID).First(&prev).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prevoz nije pronađen"})
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		var prijave []models.Prijava
		if err := tx.Where("akcija_id = ?", akcija.ID).Find(&prijave).Error; err != nil {
			return err
		}
		for _, p := range prijave {
			var izbor models.PrijavaIzbori
			if err := tx.Where("prijava_id = ?", p.ID).First(&izbor).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					continue
				}
				return err
			}
			var sel []uint
			_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &sel)
			newSel := make([]uint, 0, len(sel))
			removed := false
			for _, id := range sel {
				if id == prevozID {
					removed = true
					continue
				}
				newSel = append(newSel, id)
			}
			if !removed {
				continue
			}
			prJSON, _ := json.Marshal(newSel)
			izbor.SelectedPrevozIDs = string(prJSON)
			if err := tx.Save(&izbor).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&models.AkcijaPrevoz{}, prev.ID).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju prevoza"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Prevoz obrisan"})
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
