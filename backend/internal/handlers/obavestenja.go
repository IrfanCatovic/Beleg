// Obavestenja: lista/read/delete su po trenutnom korisniku (user_id). Broadcast šalje samo korisnicima
// effective kluba (helpers.GetEffectiveClubID), ne svima u sistemu.
package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
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
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
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

// GetObavestenjeByID vraća jedno obaveštenje ako pripada trenutnom korisniku.
func GetObavestenjeByID(c *gin.Context) {
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
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var n models.Obavestenje
	if err := db.Where("id = ? AND user_id = ?", id, korisnik.ID).First(&n).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Obaveštenje nije pronađeno"})
		return
	}

	c.JSON(http.StatusOK, n)
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
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
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
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
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
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
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

// DeleteObavestenje briše jedno obaveštenje (samo svoje).
func DeleteObavestenje(c *gin.Context) {
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
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	res := db.Where("id = ? AND user_id = ?", id, korisnik.ID).Delete(&models.Obavestenje{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Obaveštenje nije pronađeno ili nije vaše"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Obaveštenje obrisano"})
}

// BroadcastRequest body za slanje obaveštenja svima (samo admin).
type BroadcastRequest struct {
	Title string `json:"title" binding:"required"`
	Body  string `json:"body"`
}

// Broadcast šalje jedno obaveštenje svim korisnicima effective kluba (ne svim korisnicima u sistemu).
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

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (header X-Club-Id)"})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Obaveštenje poslato", "recipients": 0})
		return
	}

	var recipientIDs []uint
	db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Pluck("id", &recipientIDs)
	notifications.NotifyUsers(db, recipientIDs, models.ObavestenjeTipBroadcast, req.Title, req.Body, "", "")
	c.JSON(http.StatusOK, gin.H{"message": "Obaveštenje poslato članovima kluba", "recipients": len(recipientIDs)})
}
