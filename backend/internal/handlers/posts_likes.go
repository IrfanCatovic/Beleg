package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

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

	korisnik, ok := AuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	idStr := c.Param("id")
	postID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID objave"})
		return
	}

	post, err := getVisiblePostForViewer(db, korisnik, uint(postID))
	if err != nil {
		respondPostNotFound(c)
		return
	}

	var existing models.PostLike
	likeErr := db.Where("post_id = ? AND user_id = ?", postID, korisnik.ID).First(&existing).Error
	liked := false
	createdNew := false
	if likeErr == nil {
		if err := db.Delete(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri uklanjanju lajkа"})
			return
		}
		liked = false
	} else if errors.Is(likeErr, gorm.ErrRecordNotFound) {
		if err := ensurePostStillExists(db, uint(postID)); err != nil {
			respondPostNotFound(c)
			return
		}
		if err := db.Create(&models.PostLike{PostID: uint(postID), UserID: korisnik.ID}).Error; err != nil {
			if isDuplicateKeyDBError(err) {
				// Parallel create already succeeded — same like intent, no second notification.
				liked = true
				createdNew = false
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju lajkа"})
				return
			}
		} else {
			liked = true
			createdNew = true
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri lajkа"})
		return
	}

	// Parallel delete may have removed the post — clean our row and hide.
	if err := ensurePostStillExists(db, uint(postID)); err != nil {
		if createdNew {
			_ = db.Where("post_id = ? AND user_id = ?", postID, korisnik.ID).Delete(&models.PostLike{}).Error
		}
		respondPostNotFound(c)
		return
	}

	likeCount := countVisibleLikesForViewer(db, korisnik.ID, uint(postID))

	if createdNew && post.UserID != korisnik.ID && korisnik.KlubID != nil && post.ClubID == *korisnik.KlubID {
		likerName := strings.TrimSpace(korisnik.FullName)
		if likerName == "" {
			likerName = korisnik.Username
		}
		meta := notifications.PostNotificationMetadata(uint(postID), korisnik.ID, korisnik.Username, nil)
		notifications.NotifyUsers(
			db,
			[]uint{post.UserID},
			models.ObavestenjeTipPost,
			"Novi lajk na vašoj objavi",
			fmt.Sprintf("%s je lajkovao/la vašu objavu.", likerName),
			notifications.BuildHomeNotificationLink(),
			notifications.MarshalMetadata(meta),
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

	currentUser, ok := AuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	idStr := c.Param("id")
	postID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID objave"})
		return
	}

	if _, err := getVisiblePostForViewer(db, currentUser, uint(postID)); err != nil {
		respondPostNotFound(c)
		return
	}

	blockedIDs := blockedUserIDSlice(loadKorisniciBlockSet(db, currentUser.ID))
	likers := make([]PostLikeUserDTO, 0)
	q := db.Table("post_likes AS pl").
		Select("k.id, k.username, k.full_name, k.avatar_url, k.role").
		Joins("JOIN korisnici AS k ON k.id = pl.user_id").
		Where("pl.post_id = ?", postID).
		Where("k.role <> ?", "deleted")
	if len(blockedIDs) > 0 {
		q = q.Where("pl.user_id NOT IN ?", blockedIDs)
	}
	if err := q.Order("pl.created_at DESC").Scan(&likers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju lajkova"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"likes": likers,
		"total": len(likers),
	})
}
