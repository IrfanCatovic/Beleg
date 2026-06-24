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
)

func korisnikFromContext(c *gin.Context) (models.Korisnik, bool) {
	return AuthUser(c)
}

// GetObavestenja vraća listu obaveštenja za trenutnog korisnika.
func GetObavestenja(c *gin.Context) {
	korisnik, ok := korisnikFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	db := DB(c)

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
		"obavestenja": list,
		"unreadCount": unreadCount,
	})
}

func GetObavestenjeByID(c *gin.Context) {
	korisnik, ok := korisnikFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID obaveštenja"})
		return
	}
	db := DB(c)
	var n models.Obavestenje
	if err := db.Where("id = ? AND user_id = ?", id, korisnik.ID).First(&n).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Obaveštenje nije pronađeno"})
		return
	}
	c.JSON(http.StatusOK, n)
}

func GetUnreadCount(c *gin.Context) {
	korisnik, ok := korisnikFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	db := DB(c)
	var count int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND read_at IS NULL", korisnik.ID).Count(&count)
	c.JSON(http.StatusOK, gin.H{"unreadCount": count})
}

func MarkRead(c *gin.Context) {
	korisnik, ok := korisnikFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID obaveštenja"})
		return
	}
	db := DB(c)
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

func MarkAllRead(c *gin.Context) {
	korisnik, ok := korisnikFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	db := DB(c)
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

func DeleteObavestenje(c *gin.Context) {
	korisnik, ok := korisnikFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID obaveštenja"})
		return
	}
	db := DB(c)
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

type BroadcastRequest struct {
	Title string `json:"title" binding:"required"`
	Body  string `json:"body"`
}

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
	db := DB(c)
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
