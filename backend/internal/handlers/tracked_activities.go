package handlers

import (
	"beleg-app/backend/internal/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type activityPointInput struct {
	Lat        float64  `json:"lat"`
	Lng        float64  `json:"lng"`
	Altitude   *float64 `json:"altitude,omitempty"`
	Accuracy   *float64 `json:"accuracy,omitempty"`
	RecordedAt string   `json:"recordedAt"`
}

type appendPointsBody struct {
	Points []activityPointInput `json:"points"`
}

type finishActivityBody struct {
	DurationSec    int     `json:"durationSec"`
	DistanceM      float64 `json:"distanceM"`
	ElevationGainM float64 `json:"elevationGainM"`
	Steps          int     `json:"steps"`
	RoutePolyline  string  `json:"routePolyline"`
	EndLat         float64 `json:"endLat"`
	EndLng         float64 `json:"endLng"`
}

func findOwnedActivity(c *gin.Context, db *gorm.DB, userID uint, activityID uint) (*models.TrackedActivity, bool) {
	var activity models.TrackedActivity
	if err := db.Where("id = ? AND user_id = ?", activityID, userID).First(&activity).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Aktivnost nije pronađena"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju aktivnosti"})
		}
		return nil, false
	}
	return &activity, true
}

// StartTrackedActivity creates a new active tracking session.
func StartTrackedActivity(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	var activeCount int64
	_ = db.Model(&models.TrackedActivity{}).
		Where("user_id = ? AND status = ?", user.ID, models.TrackedActivityStatusActive).
		Count(&activeCount)
	if activeCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Već imate aktivnu sesiju. Završite je prije nove."})
		return
	}
	now := time.Now().UTC()
	activity := models.TrackedActivity{
		UserID:    user.ID,
		Status:    models.TrackedActivityStatusActive,
		StartedAt: now,
		KlubID:    user.KlubID,
	}
	if err := db.Create(&activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri pokretanju aktivnosti"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id":        activity.ID,
		"startedAt": activity.StartedAt,
		"status":    activity.Status,
	})
}

// AppendTrackedActivityPoints adds GPS points to an active activity.
func AppendTrackedActivityPoints(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan ID"})
		return
	}
	activity, okAct := findOwnedActivity(c, db, user.ID, uint(id))
	if !okAct {
		return
	}
	if activity.Status != models.TrackedActivityStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aktivnost nije aktivna"})
		return
	}
	var body appendPointsBody
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Points) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nema tačaka za dodavanje"})
		return
	}
	if len(body.Points) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Previše tačaka u jednom zahtevu (max 200)"})
		return
	}

	var maxSeq int
	_ = db.Model(&models.TrackedActivityPoint{}).
		Where("activity_id = ?", activity.ID).
		Select("COALESCE(MAX(seq), -1)").Scan(&maxSeq)

	points := make([]models.TrackedActivityPoint, 0, len(body.Points))
	for i, p := range body.Points {
		recordedAt := time.Now().UTC()
		if p.RecordedAt != "" {
			if t, err := time.Parse(time.RFC3339, p.RecordedAt); err == nil {
				recordedAt = t
			}
		}
		points = append(points, models.TrackedActivityPoint{
			ActivityID: activity.ID,
			Seq:        maxSeq + 1 + i,
			Lat:        p.Lat,
			Lng:        p.Lng,
			Altitude:   p.Altitude,
			Accuracy:   p.Accuracy,
			RecordedAt: recordedAt,
		})
	}
	if err := db.Create(&points).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju tačaka"})
		return
	}
	first := body.Points[0]
	if activity.StartLat == nil {
		activity.StartLat = &first.Lat
		activity.StartLng = &first.Lng
		_ = db.Save(activity).Error
	}
	c.JSON(http.StatusOK, gin.H{"added": len(points)})
}

// FinishTrackedActivity completes an active session.
func FinishTrackedActivity(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan ID"})
		return
	}
	activity, okAct := findOwnedActivity(c, db, user.ID, uint(id))
	if !okAct {
		return
	}
	if activity.Status != models.TrackedActivityStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aktivnost nije aktivna"})
		return
	}
	var body finishActivityBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan zahtev"})
		return
	}
	now := time.Now().UTC()
	activity.Status = models.TrackedActivityStatusCompleted
	activity.EndedAt = &now
	activity.DurationSec = body.DurationSec
	activity.DistanceM = body.DistanceM
	activity.ElevationGainM = body.ElevationGainM
	activity.Steps = body.Steps
	activity.RoutePolyline = body.RoutePolyline
	if body.EndLat != 0 || body.EndLng != 0 {
		activity.EndLat = &body.EndLat
		activity.EndLng = &body.EndLng
	}
	if err := db.Save(activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri završetku aktivnosti"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"activity": activity})
}

// DiscardTrackedActivity cancels an active session.
func DiscardTrackedActivity(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan ID"})
		return
	}
	activity, okAct := findOwnedActivity(c, db, user.ID, uint(id))
	if !okAct {
		return
	}
	if activity.Status != models.TrackedActivityStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aktivnost nije aktivna"})
		return
	}
	activity.Status = models.TrackedActivityStatusDiscarded
	now := time.Now().UTC()
	activity.EndedAt = &now
	if err := db.Save(activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Aktivnost otkazana"})
}

// GetTrackedActivity returns activity detail.
func GetTrackedActivity(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan ID"})
		return
	}
	activity, okAct := findOwnedActivity(c, db, user.ID, uint(id))
	if !okAct {
		return
	}
	c.JSON(http.StatusOK, gin.H{"activity": activity})
}

// GetMyTrackedActivities lists completed activities for the current user.
func GetMyTrackedActivities(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	limit := 20
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	var activities []models.TrackedActivity
	if err := db.Where("user_id = ? AND status = ?", user.ID, models.TrackedActivityStatusCompleted).
		Order("ended_at DESC").
		Limit(limit).
		Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju aktivnosti"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"activities": activities})
}

// GetActiveTrackedActivity returns the user's current active session if any.
func GetActiveTrackedActivity(c *gin.Context) {
	db := DB(c)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	var activity models.TrackedActivity
	err := db.Where("user_id = ? AND status = ?", user.ID, models.TrackedActivityStatusActive).
		Order("started_at DESC").
		First(&activity).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusOK, gin.H{"activity": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju aktivnosti"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"activity": activity})
}
