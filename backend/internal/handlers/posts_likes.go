package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)


type ToggleLikeResponse struct {
	Liked     bool  `json:"liked"`
	LikeCount int64 `json:"likeCount"`
}

type PostLikeUserDTO struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	FullName  string `json:"fullName"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	Role      string `json:"role"`
}

// POST /api/posts/:id/like
// Toggle lajk: ako korisnik već lajkuje post -> uklanja lajk, inače dodaje.
func TogglePostLike(c *gin.Context) {
	db := DB(c)

	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username, _ := usernameVal.(string)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	idStr := c.Param("id")
	postID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID objave"})
		return
	}

	// Proveri da post postoji
	var post models.Post
	if err := db.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Objava nije pronađena"})
		return
	}

	var existing models.PostLike
	likeErr := db.Where("post_id = ? AND user_id = ?", postID, korisnik.ID).First(&existing).Error
	liked := false
	if likeErr == nil {
		if err := db.Delete(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri uklanjanju lajkа"})
			return
		}
		liked = false
	} else if errors.Is(likeErr, gorm.ErrRecordNotFound) {
		if err := db.Create(&models.PostLike{PostID: uint(postID), UserID: korisnik.ID}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju lajkа"})
			return
		}
		liked = true
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri lajkа"})
		return
	}

	var likeCount int64
	db.Model(&models.PostLike{}).Where("post_id = ?", postID).Count(&likeCount)

	// Obavesti vlasnika objave samo kada korisnik doda lajk — i samo ako su u istom klubu kao objava.
	if liked && post.UserID != korisnik.ID && korisnik.KlubID != nil && post.ClubID == *korisnik.KlubID {
		likerName := strings.TrimSpace(korisnik.FullName)
		if likerName == "" {
			likerName = korisnik.Username
		}
		notifications.NotifyUsers(
			db,
			[]uint{post.UserID},
			models.ObavestenjeTipPost,
			"Novi lajk na vašoj objavi",
			fmt.Sprintf("%s je lajkovao/la vašu objavu.", likerName),
			"/home",
			fmt.Sprintf(`{"postId":%d}`, postID),
		)
	}

	c.JSON(http.StatusOK, ToggleLikeResponse{
		Liked:     liked,
		LikeCount: likeCount,
	})
}

// GET /api/posts/:id/likes
func GetPostLikes(c *gin.Context) {
	db := DB(c)

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

	likers := make([]PostLikeUserDTO, 0)
	if err := db.Table("post_likes AS pl").
		Select("k.id, k.username, k.full_name, k.avatar_url, k.role").
		Joins("JOIN korisnici AS k ON k.id = pl.user_id").
		Where("pl.post_id = ?", postID).
		Order("pl.created_at DESC").
		Scan(&likers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju lajkova"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"likes": likers,
		"total": len(likers),
	})
}
