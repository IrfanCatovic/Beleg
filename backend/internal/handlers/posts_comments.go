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

type CreateCommentRequest struct {
	Content string `json:"content" binding:"required"`
}

// GET /api/posts/:id/comments?limit=20&offset=0
func GetPostComments(c *gin.Context) {
	db := DB(c)

	idStr := c.Param("id")
	postID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID objave"})
		return
	}

	limit := 20
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
	db.Model(&models.PostComment{}).Where("post_id = ?", postID).Count(&total)

	var comments []models.PostComment
	if err := db.
		Preload("User", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("id, username, full_name, avatar_url")
		}).
		Where("post_id = ?", postID).
		Order("created_at ASC").
		Limit(limit).
		Offset(offset).
		Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju komentara"})
		return
	}

	type CommentUserDTO struct {
		ID           uint   `json:"id"`
		Username     string `json:"username"`
		FullName     string `json:"fullName"`
		AvatarURL    string `json:"avatarUrl,omitempty"`
		IsProfiGuide bool   `json:"isProfiGuide,omitempty"`
	}

	type CommentDTO struct {
		ID        uint            `json:"id"`
		Content   string         `json:"content"`
		CreatedAt string         `json:"createdAt"`
		User      CommentUserDTO `json:"user"`
	}

	commentUserIDs := make([]uint, 0, len(comments))
	for _, cm := range comments {
		if cm.User != nil && cm.User.ID != 0 {
			commentUserIDs = append(commentUserIDs, cm.User.ID)
		}
	}
	commentProfiSet := helpers.ApprovedProfiGuideKorisnikIDs(db, commentUserIDs)

	out := make([]CommentDTO, 0, len(comments))
	for _, cm := range comments {
		u := CommentUserDTO{}
		if cm.User != nil {
			u = CommentUserDTO{
				ID:           cm.User.ID,
				Username:     cm.User.Username,
				FullName:     cm.User.FullName,
				AvatarURL:    cm.User.AvatarURL,
				IsProfiGuide: commentProfiSet[cm.User.ID],
			}
		}

		out = append(out, CommentDTO{
			ID:        cm.ID,
			Content:   cm.Content,
			CreatedAt: cm.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			User:      u,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"comments": out,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// POST /api/posts/:id/comments
func CreatePostComment(c *gin.Context) {
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

	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Polje 'content' je obavezno"})
		return
	}

	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst komentara ne sme biti prazan"})
		return
	}
	if len(req.Content) > 1500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst komentara je predugačak (maks. 1500 karaktera)"})
		return
	}

	// Proveri da post postoji
	var post models.Post
	if err := db.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Objava nije pronađena"})
		return
	}

	comment := models.PostComment{
		PostID:  uint(postID),
		UserID:  korisnik.ID,
		Content: req.Content,
	}

	if err := db.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju komentara"})
		return
	}

	// Notifikuj označene (@username) u komentaru — samo članove kluba kojem objava pripada.
	mentions := extractMentionUsernames(req.Content)
	notifyMentionsFromContent(db, mentions, korisnik, req.Content, korisnik.ID, uint(postID), post.ClubID)

	// Obavesti vlasnika objave samo ako komentar nije od vlasnika i ako je komentator u istom klubu kao objava.
	if post.UserID != korisnik.ID && korisnik.KlubID != nil && post.ClubID == *korisnik.KlubID {
		commenterName := strings.TrimSpace(korisnik.FullName)
		if commenterName == "" {
			commenterName = korisnik.Username
		}

		// Kratki odlomak komentara (da ne bude ogroman body).
		runes := []rune(req.Content)
		snippet := req.Content
		if len(runes) > 120 {
			snippet = string(runes[:120]) + "..."
		}

		notifications.NotifyUsers(
			db,
			[]uint{post.UserID},
			models.ObavestenjeTipPost,
			"Novi komentar na vašoj objavi",
			fmt.Sprintf("%s je komentarisao/la: %s", commenterName, snippet),
			"/home",
			fmt.Sprintf(`{"postId":%d}`, postID),
		)
	}

	db.Preload("User", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, username, full_name, avatar_url")
	}).First(&comment, comment.ID)

	c.JSON(http.StatusCreated, gin.H{
		"comment": gin.H{
			"id":        comment.ID,
			"content":   comment.Content,
			"createdAt": comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			"user": gin.H{
				"id":           comment.User.ID,
				"username":     comment.User.Username,
				"fullName":     comment.User.FullName,
				"avatarUrl":    comment.User.AvatarURL,
				"isProfiGuide": helpers.KorisnikIsApprovedProfiGuide(db, comment.User.ID),
			},
		},
	})
}

// DELETE /api/posts/:id/comments/:commentId
// Dozvoljeno: vlasnik objave, admin kluba kome objava pripada, ili superadmin.
func DeletePostComment(c *gin.Context) {
	db := DB(c)

	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username, _ := usernameVal.(string)

	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID objave"})
		return
	}
	commentID, err := strconv.ParseUint(c.Param("commentId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID komentara"})
		return
	}

	var post models.Post
	if err := db.First(&post, uint(postID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Objava nije pronađena"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju objave"})
		}
		return
	}

	var comment models.PostComment
	if err := db.First(&comment, uint(commentID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Komentar nije pronađen"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju komentara"})
		}
		return
	}
	if comment.PostID != uint(postID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komentar nije pronađen"})
		return
	}

	isPostOwner := korisnik.ID == post.UserID
	isSuperadmin := role == "superadmin"
	isClubAdmin := role == "admin" && korisnik.KlubID != nil && post.ClubID == *korisnik.KlubID
	if !isPostOwner && !isSuperadmin && !isClubAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da obrišete ovaj komentar"})
		return
	}

	if err := db.Delete(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju komentara"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Komentar obrisan"})
}
