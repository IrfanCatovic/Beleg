package handlers

import (
	"beleg-app/backend/internal/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const defaultDailyStepGoal = 10000
const maxDailySteps = 100000

func parseDateYMD(s string) (time.Time, bool) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

func todayDateUTC() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

func stepsPeriodRange(period string) (fromDate, toDate time.Time, normalized string) {
	toDate = todayDateUTC()
	switch period {
	case "week":
		return toDate.AddDate(0, 0, -6), toDate, "week"
	case "month":
		from := time.Date(toDate.Year(), toDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		return from, toDate, "month"
	default:
		return toDate, toDate, "day"
	}
}

func userStepsInPeriod(db *gorm.DB, userID uint, from, to time.Time) int {
	var total int
	_ = db.Model(&models.UserDailySteps{}).
		Where("user_id = ? AND date >= ? AND date <= ?", userID, from, to).
		Select("COALESCE(SUM(steps), 0)").Scan(&total)
	return total
}

func userStepsRank(db *gorm.DB, userID uint, mySteps int, from, to time.Time, scope string, klubID *uint) int {
	if mySteps <= 0 {
		var withSteps int64
		q := db.Model(&models.UserDailySteps{}).
			Where("date >= ? AND date <= ?", from, to).
			Group("user_id").
			Having("SUM(steps) > 0")
		if scope == "club" && klubID != nil {
			q = q.Where("user_id IN (?)", db.Model(&models.Korisnik{}).Select("id").Where("klub_id = ?", *klubID))
		}
		_ = db.Table("(?) as ranked", q.Select("user_id")).Count(&withSteps)
		return int(withSteps) + 1
	}
	sub := db.Model(&models.UserDailySteps{}).
		Select("user_id").
		Where("date >= ? AND date <= ?", from, to).
		Group("user_id").
		Having("SUM(steps) > ?", mySteps)
	if scope == "club" && klubID != nil {
		sub = sub.Where("user_id IN (?)", db.Model(&models.Korisnik{}).Select("id").Where("klub_id = ?", *klubID))
	}
	var better int64
	_ = db.Table("(?) as better_users", sub).Count(&better)
	return int(better) + 1
}

func buildLeaderboardMe(db *gorm.DB, user *models.Korisnik, from, to time.Time, scope string) leaderboardEntry {
	mySteps := userStepsInPeriod(db, user.ID, from, to)
	rank := userStepsRank(db, user.ID, mySteps, from, to, scope, user.KlubID)
	return leaderboardEntry{
		UserID:    user.ID,
		Username:  user.Username,
		FullName:  user.FullName,
		AvatarURL: user.AvatarURL,
		Steps:     mySteps,
		Rank:      rank,
	}
}

func getOrCreateActivitySettings(db *gorm.DB, userID uint) (models.UserActivitySettings, error) {
	var settings models.UserActivitySettings
	err := db.Where("user_id = ?", userID).First(&settings).Error
	if err == gorm.ErrRecordNotFound {
		settings = models.UserActivitySettings{
			UserID:        userID,
			DailyStepGoal: defaultDailyStepGoal,
		}
		if err := db.Create(&settings).Error; err != nil {
			return settings, err
		}
		return settings, nil
	}
	return settings, err
}

func sumUserTotalSteps(db *gorm.DB, userID uint) int64 {
	var total int64
	_ = db.Model(&models.UserDailySteps{}).Where("user_id = ?", userID).Select("COALESCE(SUM(steps), 0)").Scan(&total)
	return total
}

// GetTodaySteps returns today's step count and goal for the current user.
func GetTodaySteps(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	settings, err := getOrCreateActivitySettings(db, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju podešavanja"})
		return
	}
	today := todayDateUTC()
	var row models.UserDailySteps
	steps := 0
	if err := db.Where("user_id = ? AND date = ?", user.ID, today).First(&row).Error; err == nil {
		steps = row.Steps
	}
	goal := settings.DailyStepGoal
	progress := 0
	if goal > 0 {
		progress = int(float64(steps) / float64(goal) * 100)
		if progress > 100 {
			progress = 100
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"date":            today.Format("2006-01-02"),
		"steps":           steps,
		"goal":            goal,
		"progressPercent": progress,
	})
}

type updateStepGoalBody struct {
	DailyStepGoal int `json:"dailyStepGoal"`
}

// UpdateStepGoal sets the user's daily step goal.
func UpdateStepGoal(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	var body updateStepGoalBody
	if err := c.ShouldBindJSON(&body); err != nil || body.DailyStepGoal < 1000 || body.DailyStepGoal > 100000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cilj mora biti između 1.000 i 100.000"})
		return
	}
	settings, err := getOrCreateActivitySettings(db, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju podešavanja"})
		return
	}
	settings.DailyStepGoal = body.DailyStepGoal
	if err := db.Save(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju cilja"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"dailyStepGoal": settings.DailyStepGoal})
}

type syncStepsBody struct {
	Date  string `json:"date"`
	Steps int    `json:"steps"`
}

// SyncDailySteps upserts daily steps (keeps max of stored and incoming).
func SyncDailySteps(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	var body syncStepsBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan zahtev"})
		return
	}
	if body.Steps < 0 || body.Steps > maxDailySteps {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan broj koraka"})
		return
	}
	date, okDate := parseDateYMD(body.Date)
	if !okDate {
		date = todayDateUTC()
	}
	var existing models.UserDailySteps
	err := db.Where("user_id = ? AND date = ?", user.ID, date).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		row := models.UserDailySteps{
			UserID: user.ID,
			Date:   date,
			Steps:  body.Steps,
			Source: "pedometer",
		}
		if err := db.Create(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri sinhronizaciji"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"steps": row.Steps, "date": date.Format("2006-01-02")})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri sinhronizaciji"})
		return
	}
	if body.Steps > existing.Steps {
		existing.Steps = body.Steps
		if err := db.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri sinhronizaciji"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"steps": existing.Steps, "date": date.Format("2006-01-02")})
}

type stepsHistoryDay struct {
	Date  string `json:"date"`
	Steps int    `json:"steps"`
}

// GetStepsHistory returns daily step counts for a date range (max one calendar month).
func GetStepsHistory(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	fromStr := c.Query("from")
	toStr := c.Query("to")
	from, okFrom := parseDateYMD(fromStr)
	to, okTo := parseDateYMD(toStr)
	if !okFrom || !okTo || to.Before(from) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan raspon datuma"})
		return
	}
	if from.Year() != to.Year() || from.Month() != to.Month() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Raspon mora biti unutar jednog kalendarskog meseca"})
		return
	}
	var rows []models.UserDailySteps
	if err := db.Where("user_id = ? AND date >= ? AND date <= ?", user.ID, from, to).
		Order("date ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju istorije"})
		return
	}
	stepMap := make(map[string]int, len(rows))
	for _, r := range rows {
		stepMap[r.Date.Format("2006-01-02")] = r.Steps
	}
	days := make([]stepsHistoryDay, 0)
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		days = append(days, stepsHistoryDay{Date: key, Steps: stepMap[key]})
	}
	c.JSON(http.StatusOK, gin.H{"days": days})
}

type leaderboardEntry struct {
	UserID    uint   `json:"userId"`
	Username  string `json:"username"`
	FullName  string `json:"fullName,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	Steps     int    `json:"steps"`
	Rank      int    `json:"rank"`
}

// GetStepsLeaderboard returns step rankings for global or club scope.
func GetStepsLeaderboard(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	scope := c.DefaultQuery("scope", "global")
	period := c.DefaultQuery("period", "day")
	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	fromDate, toDate, period := stepsPeriodRange(period)

	if scope == "club" && user.KlubID == nil {
		me := buildLeaderboardMe(db, user, fromDate, toDate, scope)
		c.JSON(http.StatusOK, gin.H{"entries": []leaderboardEntry{}, "me": me, "scope": scope, "period": period})
		return
	}

	type aggRow struct {
		UserID uint
		Steps  int
	}
	var rows []aggRow
	q := db.Model(&models.UserDailySteps{}).
		Select("user_id, SUM(steps) as steps").
		Where("date >= ? AND date <= ?", fromDate, toDate).
		Group("user_id").
		Order("steps DESC").
		Limit(limit)

	if scope == "club" {
		q = q.Where("user_id IN (?)", db.Model(&models.Korisnik{}).Select("id").Where("klub_id = ?", *user.KlubID))
	}

	if err := q.Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju rang liste"})
		return
	}

	entries := make([]leaderboardEntry, 0, len(rows))
	for i, row := range rows {
		var k models.Korisnik
		_ = db.First(&k, row.UserID).Error
		entries = append(entries, leaderboardEntry{
			UserID:    row.UserID,
			Username:  k.Username,
			FullName:  k.FullName,
			AvatarURL: k.AvatarURL,
			Steps:     row.Steps,
			Rank:      i + 1,
		})
	}
	me := buildLeaderboardMe(db, user, fromDate, toDate, scope)
	c.JSON(http.StatusOK, gin.H{"entries": entries, "me": me, "scope": scope, "period": period})
}

// GetMyActivityStats returns lifetime step total and activity counts.
func GetMyActivityStats(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	totalSteps := sumUserTotalSteps(db, user.ID)
	var completedCount int64
	_ = db.Model(&models.TrackedActivity{}).
		Where("user_id = ? AND status = ?", user.ID, models.TrackedActivityStatusCompleted).
		Count(&completedCount)
	var totalDistance float64
	_ = db.Model(&models.TrackedActivity{}).
		Where("user_id = ? AND status = ?", user.ID, models.TrackedActivityStatusCompleted).
		Select("COALESCE(SUM(distance_m), 0)").Scan(&totalDistance)

	c.JSON(http.StatusOK, gin.H{
		"ukupnoKoraka":    totalSteps,
		"completedCount":  completedCount,
		"totalDistanceM": totalDistance,
	})
}

// Ensure settings row exists on first access — used by other handlers via getOrCreateActivitySettings.
