package handlers

import (
	"net/http"
	"strings"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreatePostRequest predstavlja payload za kreiranje novog posta.
type CreatePostRequest struct {
	Content string `json:"content" binding:"required"`
	ImageURL string `json:"imageUrl"`
}

// GetPosts vraća listu postova za "effective" klub korisnika.
// Za sada samo osnovne informacije (bez lajkova i komentara).
func GetPosts(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok || clubID == 0 {
		c.JSON(http.StatusOK, gin.H{"posts": []models.Post{}})
		return
	}

	var posts []models.Post
	if err := db.
		Preload("Author", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("id, username, full_name, avatar_url")
		}).
		Where("club_id = ?", clubID).
		Order("created_at DESC").
		Limit(50).
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju objava"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"posts": posts})
}

// CreatePost kreira novi post u okviru effective kluba i trenutnog korisnika kao autora.
func CreatePost(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username, _ := usernameVal.(string)

	var korisnik models.Korisnik
	if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok || clubID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (X-Club-Id) ili niste u klubu"})
		return
	}

	var req CreatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Polje 'content' je obavezno"})
		return
	}

	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave ne sme biti prazan"})
		return
	}
	if len(req.Content) > 4000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave je predugačak (maks. 4000 karaktera)"})
		return
	}

	post := models.Post{
		ClubID:   clubID,
		AuthorID: korisnik.ID,
		Content:  req.Content,
		ImageURL: strings.TrimSpace(req.ImageURL),
	}

	if err := db.Create(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju objave"})
		return
	}

	// Ponovo učitamo autora sa osnovnim poljima radi frontend prikaza
	db.Preload("Author", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, username, full_name, avatar_url")
	}).First(&post, post.ID)

	c.JSON(http.StatusCreated, gin.H{"post": post})
}

