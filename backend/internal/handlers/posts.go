package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreatePostRequest struct {
	Content  string `json:"content" binding:"required"`
	ImageURL string `json:"imageUrl"`
}

func GetPosts(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	limit := 30
	offset := 0
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}

	var total int64
	db.Model(&models.Post{}).Count(&total)

	var posts []models.Post
	if err := db.
		Preload("User", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("id, username, full_name, avatar_url, role, klub_id")
		}).
		Preload("User.Klub", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("id, naziv, logo_url")
		}).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju objava"})
		return
	}

	type UserDTO struct {
		ID        uint   `json:"id"`
		Username  string `json:"username"`
		FullName  string `json:"fullName"`
		AvatarURL string `json:"avatarUrl,omitempty"`
		Role      string `json:"role"`
		KlubNaziv string `json:"klubNaziv,omitempty"`
	}

	type PostDTO struct {
		ID        uint    `json:"id"`
		Content   string  `json:"content"`
		ImageURL  string  `json:"imageUrl,omitempty"`
		CreatedAt string  `json:"createdAt"`
		User      UserDTO `json:"user"`
	}

	out := make([]PostDTO, 0, len(posts))
	for _, p := range posts {
		u := UserDTO{}
		if p.User != nil {
			u.ID = p.User.ID
			u.Username = p.User.Username
			u.FullName = p.User.FullName
			u.AvatarURL = p.User.AvatarURL
			u.Role = p.User.Role
			if p.User.Klub != nil {
				u.KlubNaziv = p.User.Klub.Naziv
			}
		}
		out = append(out, PostDTO{
			ID:        p.ID,
			Content:   p.Content,
			ImageURL:  p.ImageURL,
			CreatedAt: p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			User:      u,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"posts":  out,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

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
	if len(req.Content) > 3000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave je predugačak (maks. 3000 karaktera)"})
		return
	}

	post := models.Post{
		UserID:   korisnik.ID,
		Content:  req.Content,
		ImageURL: strings.TrimSpace(req.ImageURL),
	}

	if err := db.Create(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju objave"})
		return
	}

	db.Preload("User", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, username, full_name, avatar_url, role, klub_id")
	}).Preload("User.Klub", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, naziv, logo_url")
	}).First(&post, post.ID)

	klubNaziv := ""
	if post.User != nil && post.User.Klub != nil {
		klubNaziv = post.User.Klub.Naziv
	}

	c.JSON(http.StatusCreated, gin.H{"post": gin.H{
		"id":        post.ID,
		"content":   post.Content,
		"imageUrl":  post.ImageURL,
		"createdAt": post.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"user": gin.H{
			"id":        post.User.ID,
			"username":  post.User.Username,
			"fullName":  post.User.FullName,
			"avatarUrl": post.User.AvatarURL,
			"role":      post.User.Role,
			"klubNaziv": klubNaziv,
		},
	}})
}

func DeletePost(c *gin.Context) {
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

	idStr := c.Param("id")
	postID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID objave"})
		return
	}

	var post models.Post
	if err := db.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Objava nije pronađena"})
		return
	}

	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	isAdmin := role == "admin" || role == "superadmin"
	if post.UserID != korisnik.ID && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Možete obrisati samo svoje objave"})
		return
	}

	if err := db.Delete(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju objave"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Objava obrisana"})
}
