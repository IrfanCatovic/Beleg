package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetObavestenja vraća listu obaveštenja za trenutnog korisnika.
// Query: limit (default 20), offset (default 0). U odgovoru i unreadCount.
func GetObavestenja(c *gin.Context) {
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username := usernameVal.(string)

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	limit := 20
	offset := 0
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}

	var list []models.Obavestenje
	if err := db.Where("user_id = ?", korisnik.ID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju obaveštenja"})
		return
	}

	var unreadCount int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND read_at IS NULL", korisnik.ID).Count(&unreadCount)

	c.JSON(http.StatusOK, gin.H{
		"obavestenja":   list,
		"unreadCount":   unreadCount,
	})
}

// GetUnreadCount vraća samo broj nepročitanih obaveštenja (za badge).
func GetUnreadCount(c *gin.Context) {
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username := usernameVal.(string)

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var count int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND read_at IS NULL", korisnik.ID).Count(&count)
	c.JSON(http.StatusOK, gin.H{"unreadCount": count})
}

// MarkRead označava jedno obaveštenje kao pročitano (PATCH /api/notifications/:id/read).
func MarkRead(c *gin.Context) {
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username := usernameVal.(string)

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID obaveštenja"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	now := time.Now()
	res := db.Model(&models.Obavestenje{}).
		Where("id = ? AND user_id = ?", id, korisnik.ID).
		Update("read_at", now)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Obaveštenje nije pronađeno ili nije vaše"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Označeno kao pročitano"})
}

// MarkAllRead označava sva obaveštenja trenutnog korisnika kao pročitana (npr. kada otvori meni).
func MarkAllRead(c *gin.Context) {
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username := usernameVal.(string)

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	now := time.Now()
	res := db.Model(&models.Obavestenje{}).
		Where("user_id = ? AND read_at IS NULL", korisnik.ID).
		Update("read_at", now)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Sva obaveštenja označena kao pročitana", "count": res.RowsAffected})
}

// BroadcastRequest body za slanje obaveštenja svima (samo admin).
type BroadcastRequest struct {
	Title string `json:"title" binding:"required"`
	Body  string `json:"body"`
}

// Broadcast šalje jedno obaveštenje svim korisnicima. Samo admin ili superadmin.
func Broadcast(c *gin.Context) {
	roleVal, _ := c.Get("role")
	if roleVal != "admin" && roleVal != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili superadmin može da pošalje obaveštenje svima"})
		return
	}

	var req BroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno polje: title"})
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naslov ne sme biti prazan"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var allIDs []uint
	db.Model(&models.Korisnik{}).Pluck("id", &allIDs)
	notifications.NotifyUsers(db, allIDs, models.ObavestenjeTipBroadcast, req.Title, req.Body, "")
	c.JSON(http.StatusOK, gin.H{"message": "Obaveštenje poslato svima", "recipients": len(allIDs)})
}
