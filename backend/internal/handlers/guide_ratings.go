package handlers

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type guideRatingBody struct {
	Ocena    *int   `json:"ocena"`
	Komentar string `json:"komentar"`
}

func recalcGuideProfileRatings(db *gorm.DB, guideProfileID uint) error {
	var rows []models.GuideActionRating
	if err := db.Where("guide_profile_id = ? AND ocena IS NOT NULL", guideProfileID).Find(&rows).Error; err != nil {
		return err
	}
	var gp models.GuideProfile
	if err := db.First(&gp, guideProfileID).Error; err != nil {
		return err
	}
	if len(rows) == 0 {
		gp.ProsecnaOcena = 0
		gp.BrojOcena = 0
		return db.Save(&gp).Error
	}
	sum := 0
	for _, r := range rows {
		if r.Ocena != nil {
			sum += *r.Ocena
		}
	}
	gp.BrojOcena = len(rows)
	gp.ProsecnaOcena = math.Round((float64(sum)/float64(len(rows)))*100) / 100
	return db.Save(&gp).Error
}

func loadAkcijaForGuideRating(c *gin.Context, db *gorm.DB) (*models.Akcija, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan ID akcije"})
		return nil, false
	}
	var akcija models.Akcija
	if err := db.First(&akcija, uint(id)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
			return nil, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju akcije"})
		return nil, false
	}
	return &akcija, true
}

func participantCanRateGuide(c *gin.Context, db *gorm.DB, akcija *models.Akcija, rater *models.Korisnik) bool {
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ocenjivanje je moguće tek nakon završetka akcije"})
		return false
	}
	if akcija.VodicID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija nema dodeljenog vodiča"})
		return false
	}
	if rater.ID == akcija.VodicID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Vodič ne može oceniti sam sebe"})
		return false
	}
	var prijava models.Prijava
	err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, rater.ID).First(&prijava).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Samo učesnici akcije mogu oceniti vodiča"})
			return false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri prijave"})
		return false
	}
	if prijava.Status != "popeo se" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Ocenu mogu ostaviti samo učesnici označeni kao uspešno popeo se"})
		return false
	}
	return true
}

func approvedGuideProfileForVodic(db *gorm.DB, vodicID uint) (*models.GuideProfile, bool) {
	var gp models.GuideProfile
	err := db.Where("korisnik_id = ? AND status = ?", vodicID, models.GuideStatusApproved).First(&gp).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false
		}
		return nil, false
	}
	return &gp, true
}

func guideRatingNotApplicable() gin.H {
	return gin.H{"submitted": false, "applicable": false, "rating": nil}
}

// GetMyGuideRatingForAkcija GET /api/akcije/:id/guide-rating/mine
func GetMyGuideRatingForAkcija(c *gin.Context) {
	db := DB(c)
	k, ok := currentKorisnik(c, db)
	if !ok {
		return
	}
	akcija, ok := loadAkcijaForGuideRating(c, db)
	if !ok {
		return
	}
	if !akcija.IsCompleted || akcija.VodicID == 0 || k.ID == akcija.VodicID {
		c.JSON(http.StatusOK, guideRatingNotApplicable())
		return
	}
	var prijava models.Prijava
	err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, k.ID).First(&prijava).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, guideRatingNotApplicable())
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri prijave"})
		return
	}
	if prijava.Status != "popeo se" {
		c.JSON(http.StatusOK, guideRatingNotApplicable())
		return
	}
	if !helpers.VodicCanReceiveGuideRatings(db, akcija.VodicID) {
		c.JSON(http.StatusOK, guideRatingNotApplicable())
		return
	}
	var row models.GuideActionRating
	err = db.Where("akcija_id = ? AND rater_korisnik_id = ?", akcija.ID, k.ID).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"submitted": false, "applicable": true, "rating": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju ocene"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"submitted":  true,
		"applicable": true,
		"rating": gin.H{
			"id":       row.ID,
			"ocena":    row.Ocena,
			"komentar": strings.TrimSpace(row.Komentar),
		},
	})
}

// SubmitGuideRatingForAkcija POST /api/akcije/:id/guide-rating
func SubmitGuideRatingForAkcija(c *gin.Context) {
	db := DB(c)
	k, ok := currentKorisnik(c, db)
	if !ok {
		return
	}
	akcija, ok := loadAkcijaForGuideRating(c, db)
	if !ok {
		return
	}
	if !participantCanRateGuide(c, db, akcija, k) {
		return
	}

	if !helpers.VodicCanReceiveGuideRatings(db, akcija.VodicID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vodič nema odobren profi vodički profil za ocenjivanje"})
		return
	}

	gp, hasProfile := approvedGuideProfileForVodic(db, akcija.VodicID)
	if !hasProfile {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vodič nema odobren profi vodički profil za ocenjivanje"})
		return
	}

	var body guideRatingBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan JSON"})
		return
	}
	komentar := strings.TrimSpace(body.Komentar)

	if body.Ocena == nil && komentar == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite ocenu ili preskočite ocenjivanje"})
		return
	}
	if komentar != "" && body.Ocena == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Komentar zahteva ocenu od 1 do 5"})
		return
	}
	if body.Ocena != nil {
		if *body.Ocena < 1 || *body.Ocena > 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ocena mora biti između 1 i 5"})
			return
		}
	}

	var existing models.GuideActionRating
	if err := db.Where("akcija_id = ? AND rater_korisnik_id = ?", akcija.ID, k.ID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Već ste ocenili vodiča za ovu akciju"})
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri postojeće ocene"})
		return
	}

	row := models.GuideActionRating{
		AkcijaID:        akcija.ID,
		RaterKorisnikID: k.ID,
		GuideProfileID:  gp.ID,
		GuideKorisnikID: akcija.VodicID,
		Ocena:           body.Ocena,
		Komentar:        komentar,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		if body.Ocena != nil {
			return recalcGuideProfileRatings(tx, gp.ID)
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju ocene"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Ocena je sačuvana",
		"rating": gin.H{
			"id":       row.ID,
			"ocena":    row.Ocena,
			"komentar": komentar,
		},
	})
}

// GetPublicKorisnikGuideRecenzije GET /api/korisnici/:id/recenzije-vodica
func GetPublicKorisnikGuideRecenzije(c *gin.Context) {
	db := DB(c)
	param := c.Param("id")
	korisnik := getKorisnikByIDOrUsername(db, param)
	if korisnik == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if !helpers.KorisnikIsApprovedProfiGuide(db, korisnik.ID) {
		c.JSON(http.StatusOK, gin.H{
			"guide": gin.H{
				"id":       korisnik.ID,
				"username": korisnik.Username,
				"fullName": korisnik.FullName,
			},
			"summary": gin.H{"prosecnaOcena": 0, "brojOcena": 0, "brojKomentara": 0},
			"recenzije": []gin.H{},
		})
		return
	}

	var gp models.GuideProfile
	if err := db.Where("korisnik_id = ? AND status = ?", korisnik.ID, models.GuideStatusApproved).First(&gp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Profil vodiča nije pronađen"})
		return
	}

	var rows []models.GuideActionRating
	if err := db.Where("guide_korisnik_id = ?", korisnik.ID).
		Preload("Akcija").
		Preload("Rater").
		Order("created_at DESC").
		Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju recenzija"})
		return
	}

	var brojKomentara int64
	for _, row := range rows {
		if strings.TrimSpace(row.Komentar) != "" {
			brojKomentara++
		}
	}

	out := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		item := gin.H{
			"id":        row.ID,
			"ocena":     row.Ocena,
			"komentar":  strings.TrimSpace(row.Komentar),
			"createdAt": row.CreatedAt,
		}
		if row.Akcija.ID != 0 {
			item["akcija"] = gin.H{
				"id":    row.Akcija.ID,
				"naziv": row.Akcija.Naziv,
				"datum": row.Akcija.Datum,
			}
		}
		if row.Rater.ID != 0 {
			item["rater"] = gin.H{
				"id":         row.Rater.ID,
				"username":   row.Rater.Username,
				"fullName":   row.Rater.FullName,
				"avatar_url": row.Rater.AvatarURL,
			}
		}
		out = append(out, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"guide": gin.H{
			"id":         korisnik.ID,
			"username":   korisnik.Username,
			"fullName":   korisnik.FullName,
			"avatar_url": korisnik.AvatarURL,
		},
		"summary": gin.H{
			"prosecnaOcena": gp.ProsecnaOcena,
			"brojOcena":     gp.BrojOcena,
			"brojKomentara": brojKomentara,
		},
		"recenzije": out,
	})
}
