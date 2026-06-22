package handlers

import (
	"beleg-app/backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type clubLeaderboardEntry struct {
	KlubID     uint   `json:"klubId"`
	Naziv      string `json:"naziv"`
	LogoURL    string `json:"logoUrl,omitempty"`
	TotalSteps int    `json:"totalSteps"`
	Rank       int    `json:"rank"`
}

func clubStepsRank(db *gorm.DB, klubID uint, mySteps int, from, to interface{}) int {
	if mySteps <= 0 {
		var withSteps int64
		sub := db.Table("user_daily_steps uds").
			Select("k.klub_id").
			Joins("JOIN korisnici k ON k.id = uds.user_id").
			Where("uds.date >= ? AND uds.date <= ? AND k.klub_id IS NOT NULL", from, to).
			Group("k.klub_id").
			Having("SUM(uds.steps) > 0")
		_ = db.Table("(?) as ranked", sub).Count(&withSteps)
		return int(withSteps) + 1
	}
	sub := db.Table("user_daily_steps uds").
		Select("k.klub_id").
		Joins("JOIN korisnici k ON k.id = uds.user_id").
		Where("uds.date >= ? AND uds.date <= ? AND k.klub_id IS NOT NULL", from, to).
		Group("k.klub_id").
		Having("SUM(uds.steps) > ?", mySteps)
	var better int64
	_ = db.Table("(?) as better_clubs", sub).Count(&better)
	return int(better) + 1
}

func clubStepsTotal(db *gorm.DB, klubID uint, from, to interface{}) int {
	var total int
	_ = db.Table("user_daily_steps uds").
		Select("COALESCE(SUM(uds.steps), 0)").
		Joins("JOIN korisnici k ON k.id = uds.user_id").
		Where("k.klub_id = ? AND uds.date >= ? AND uds.date <= ?", klubID, from, to).
		Scan(&total)
	return total
}

// GetClubsStepsLeaderboard returns monthly step totals aggregated by club.
func GetClubsStepsLeaderboard(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	period := c.DefaultQuery("period", "month")
	fromDate, toDate, period := stepsPeriodRange(period)

	type aggRow struct {
		KlubID uint
		Steps  int
	}
	var rows []aggRow
	err := db.Table("user_daily_steps uds").
		Select("k.klub_id as klub_id, SUM(uds.steps) as steps").
		Joins("JOIN korisnici k ON k.id = uds.user_id").
		Where("uds.date >= ? AND uds.date <= ? AND k.klub_id IS NOT NULL", fromDate, toDate).
		Group("k.klub_id").
		Order("steps DESC").
		Limit(10).
		Scan(&rows).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju rang liste klubova"})
		return
	}

	entries := make([]clubLeaderboardEntry, 0, len(rows))
	for i, row := range rows {
		var klub models.Klubovi
		_ = db.First(&klub, row.KlubID).Error
		entries = append(entries, clubLeaderboardEntry{
			KlubID:     row.KlubID,
			Naziv:      klub.Naziv,
			LogoURL:    klub.LogoURL,
			TotalSteps: row.Steps,
			Rank:       i + 1,
		})
	}

	var myClub *clubLeaderboardEntry
	if user.KlubID != nil {
		total := clubStepsTotal(db, *user.KlubID, fromDate, toDate)
		rank := clubStepsRank(db, *user.KlubID, total, fromDate, toDate)
		var klub models.Klubovi
		_ = db.First(&klub, *user.KlubID).Error
		myClub = &clubLeaderboardEntry{
			KlubID:     *user.KlubID,
			Naziv:      klub.Naziv,
			LogoURL:    klub.LogoURL,
			TotalSteps: total,
			Rank:       rank,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"entries": entries,
		"myClub":  myClub,
		"period":  period,
	})
}
