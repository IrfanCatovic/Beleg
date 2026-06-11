package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func getKorisnikByIDOrUsername(db *gorm.DB, param string) *models.Korisnik {
	param = strings.TrimSpace(param)
	if param == "" {
		return nil
	}
	if id, err := strconv.Atoi(param); err == nil {
		var k models.Korisnik
		if db.First(&k, id).Error == nil && k.Role != "deleted" {
			return &k
		}
		return nil
	}
	var k models.Korisnik
	if helpers.DBWhereUsername(db, param).First(&k).Error == nil && k.Role != "deleted" {
		return &k
	}
	return nil
}

func GetPublicKorisnik(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	param := c.Param("id")
	korisnik := getKorisnikByIDOrUsername(db, param)
	if korisnik == nil {
		c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if korisnik.KlubID != nil {
		var klub models.Klubovi
		if db.First(&klub, *korisnik.KlubID).Error == nil {
			korisnik.KlubNaziv = klub.Naziv
			korisnik.KlubLogoURL = klub.LogoURL
		}
	}
	respPub := gin.H{
		"id":                 korisnik.ID,
		"username":           korisnik.Username,
		"fullName":           korisnik.FullName,
		"avatar_url":         korisnik.AvatarURL,
		"cover_image_url":    korisnik.CoverImageURL,
		"cover_position_y":   korisnik.CoverPositionY,
		"role":               korisnik.Role,
		"createdAt":          korisnik.CreatedAt,
		"updatedAt":          korisnik.UpdatedAt,
		"ukupnoKm":           korisnik.UkupnoKmKorisnik,
		"ukupnoMetaraUspona": korisnik.UkupnoMetaraUsponaKorisnik,
		"brojPopeoSe":        korisnik.BrojPopeoSe,
		"klubNaziv":          korisnik.KlubNaziv,
		"klubLogoUrl":        korisnik.KlubLogoURL,
	}
	if korisnik.CoverPositionYMobile != nil {
		respPub["cover_position_y_mobile"] = *korisnik.CoverPositionYMobile
	}
	respPub["isProfiGuide"] = helpers.KorisnikIsApprovedProfiGuide(db, korisnik.ID)
	c.JSON(200, respPub)
}

func GetPublicKorisnikStatistika(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	param := c.Param("id")
	korisnik := getKorisnikByIDOrUsername(db, param)
	if korisnik == nil {
		c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var prijave []models.Prijava
	if err := db.Where("korisnik_id = ? AND status = ?", korisnik.ID, "popeo se").
		Preload("Akcija").
		Find(&prijave).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju statistike", "details": err.Error()})
		return
	}

	var ukupnoKm float64
	var ukupnoMetaraUspona int
	var brojPopeoSe int
	for _, p := range prijave {
		if p.Akcija.ID == 0 {
			continue
		}
		ukupnoKm += p.Akcija.UkupnoKmAkcija
		ukupnoMetaraUspona += p.Akcija.UkupnoMetaraUsponaAkcija
		brojPopeoSe++
	}

	c.JSON(200, gin.H{
		"statistika": map[string]interface{}{
			"ukupnoKm":           ukupnoKm,
			"ukupnoMetaraUspona": ukupnoMetaraUspona,
			"brojPopeoSe":        brojPopeoSe,
		},
	})
}

func GetPublicKorisnikPopeoSe(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	param := c.Param("id")
	korisnik := getKorisnikByIDOrUsername(db, param)
	if korisnik == nil {
		c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	targetID := int(korisnik.ID)
	var prijave []models.Prijava
	if err := db.Where("korisnik_id = ? AND status = ?", targetID, "popeo se").
		Preload("Akcija").
		Find(&prijave).Error; err != nil {
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
	c.JSON(200, gin.H{
		"uspesneAkcije": uspesneAkcije,
		"statistika": map[string]interface{}{
			"ukupnoKm":           ukupnoKm,
			"ukupnoMetaraUspona": ukupnoMetaraUspona,
			"brojPopeoSe":        brojPopeoSe,
		},
	})
}

// GetPublicKorisnikVodio — završene ture koje je korisnik vodio kao profi vodič (trenutno via ferrata).
func GetPublicKorisnikVodio(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	param := c.Param("id")
	korisnik := getKorisnikByIDOrUsername(db, param)
	if korisnik == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if !helpers.KorisnikIsApprovedProfiGuide(db, korisnik.ID) {
		c.JSON(http.StatusOK, gin.H{"vodeneAkcije": []models.Akcija{}})
		return
	}

	var vodeneAkcije []models.Akcija
	q := db.Where(
		"vodic_id = ? AND LOWER(TRIM(organizator_tip)) = ? AND is_completed = ? AND tip_akcije = ?",
		korisnik.ID, "vodic", true, "via_ferrata",
	)
	if err := q.Order("datum DESC").Find(&vodeneAkcije).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju vođenih akcija"})
		return
	}

	for i := range vodeneAkcije {
		if vodeneAkcije[i].SlikaURL != "" || vodeneAkcije[i].FerrataID == nil {
			continue
		}
		var ft models.Ferrata
		if err := db.Select("cover_image").First(&ft, *vodeneAkcije[i].FerrataID).Error; err == nil {
			if u := strings.TrimSpace(ft.CoverImage); u != "" {
				vodeneAkcije[i].SlikaURL = u
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"vodeneAkcije": vodeneAkcije})
}
