package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreatePostRequest struct {
	Content  string `json:"content" binding:"required"`
	ImageURL string `json:"imageUrl"`
}

func GetPosts(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username, _ := usernameVal.(string)

	var currentUser models.Korisnik
	if err := db.Where("username = ?", username).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

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

	// Engagement (lajkovi/komentari) - agregacije za prikaz u listi.
	// Ovo izbegava N+1 upite (30 postova => max 3 dodatne query-je).
	postIDs := make([]uint, 0, len(posts))
	for _, p := range posts {
		postIDs = append(postIDs, p.ID)
	}

	type likeCountRow struct {
		PostID uint
		Cnt    int64
	}
	likeCountMap := make(map[uint]int64, len(posts))
	if len(postIDs) > 0 {
		var likeRows []likeCountRow
		if err := db.Model(&models.PostLike{}).
			Select("post_id, count(*) as cnt").
			Where("post_id IN ?", postIDs).
			Group("post_id").
			Scan(&likeRows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju lajkova"})
			return
		}
		for _, r := range likeRows {
			likeCountMap[r.PostID] = r.Cnt
		}
	}

	likedSet := make(map[uint]bool, len(posts))
	if len(postIDs) > 0 {
		var likedPostIDs []uint
		_ = db.Model(&models.PostLike{}).
			Where("user_id = ? AND post_id IN ?", currentUser.ID, postIDs).
			Pluck("post_id", &likedPostIDs).Error
		for _, pid := range likedPostIDs {
			likedSet[pid] = true
		}
	}

	type commentCountRow struct {
		PostID uint
		Cnt    int64
	}
	commentCountMap := make(map[uint]int64, len(posts))
	if len(postIDs) > 0 {
		var commentRows []commentCountRow
		if err := db.Model(&models.PostComment{}).
			Select("post_id, count(*) as cnt").
			Where("post_id IN ?", postIDs).
			Group("post_id").
			Scan(&commentRows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju komentara"})
			return
		}
		for _, r := range commentRows {
			commentCountMap[r.PostID] = r.Cnt
		}
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
		ID           uint    `json:"id"`
		Content      string  `json:"content"`
		ImageURL     string  `json:"imageUrl,omitempty"`
		CreatedAt    string  `json:"createdAt"`
		User         UserDTO `json:"user"`
		LikeCount    int64   `json:"likeCount"`
		CommentCount int64   `json:"commentCount"`
		MyLiked      bool    `json:"myLiked"`
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
			ID:            p.ID,
			Content:      p.Content,
			ImageURL:     p.ImageURL,
			CreatedAt:    p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			User:         u,
			LikeCount:    likeCountMap[p.ID],
			CommentCount: commentCountMap[p.ID],
			MyLiked:      likedSet[p.ID],
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

	// ClubID polje u bazi je NOT NULL (zbog ranije sheme).
	// Feed je globalan, ali moramo da popunimo vrednost za integritet.
	var clubID uint
	if korisnik.KlubID != nil {
		clubID = *korisnik.KlubID
	} else {
		// superadmin mora imati izabran klub u header-u, inače nema šta da upiše
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		if role == "superadmin" {
			effectiveClubID, ok := helpers.GetEffectiveClubID(c, db)
			if !ok || effectiveClubID == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (X-Club-Id) da biste postavili objavu"})
				return
			}
			clubID = effectiveClubID
		}
	}

	contentType := strings.ToLower(c.GetHeader("Content-Type"))
	isMultipart := strings.HasPrefix(contentType, "multipart/form-data")

	var content string
	var imageURL string

	if isMultipart {
		// multipart: content (text) + image (file)
		if err := c.Request.ParseMultipartForm(20 << 20); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
			return
		}

		content = strings.TrimSpace(c.PostForm("content"))
		if content == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave ne sme biti prazan"})
			return
		}
		if len(content) > 3000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave je predugačak (maks. 3000 karaktera)"})
			return
		}

		files := c.Request.MultipartForm.File["image"]
		if len(files) > 0 {
			fileHeader := files[0]
			clubID := uint(0)
			folder := helpers.CloudinaryFolderSetup()
			if korisnik.KlubID != nil {
				clubID = *korisnik.KlubID
				folder = helpers.CloudinaryFolderForClub(clubID)
			}

			if err := helpers.CheckStorageLimit(db, clubID, fileHeader.Size); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			f, err := fileHeader.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju fajla"})
				return
			}
			defer f.Close()

			cld, err := cloudinary.NewFromParams(
				os.Getenv("CLOUDINARY_CLOUD_NAME"),
				os.Getenv("CLOUDINARY_API_KEY"),
				os.Getenv("CLOUDINARY_API_SECRET"),
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri inicijalizaciji Cloudinary-ja"})
				return
			}

			ctx := context.Background()
			uploadParams := uploader.UploadParams{
				PublicID:       fmt.Sprintf("posts/post-%d-%d", korisnik.ID, time.Now().Unix()),
				Folder:         folder,
				Transformation: "q_auto:good,f_auto",
			}

			uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u slike"})
				return
			}

			if err := helpers.AddStorageUsage(db, clubID, fileHeader.Size); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri evidentiranju storage zauzeća"})
				return
			}

			imageURL = uploadResult.SecureURL
		}
	} else {
		// json: content + opcioni imageUrl
		var req CreatePostRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Polje 'content' je obavezno"})
			return
		}

		content = strings.TrimSpace(req.Content)
		imageURL = strings.TrimSpace(req.ImageURL)

		if content == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave ne sme biti prazan"})
			return
		}
		if len(content) > 3000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave je predugačak (maks. 3000 karaktera)"})
			return
		}
	}

	post := models.Post{
		ClubID:   clubID,
		UserID:   korisnik.ID,
		AuthorID: korisnik.ID,
		Content:  content,
		ImageURL: imageURL,
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
		"likeCount":    int64(0),
		"commentCount": int64(0),
		"myLiked":      false,
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

	// Čisti engagement kako ne bi ostali orphan zapisi.
	_ = db.Where("post_id = ?", postID).Delete(&models.PostLike{}).Error
	_ = db.Where("post_id = ?", postID).Delete(&models.PostComment{}).Error

	// Zakaži brisanje Cloudinary slike (ako je post ima).
	if post.ImageURL != "" {
		helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), post.ImageURL)
	}

	if err := db.Delete(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju objave"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Objava obrisana"})
}

type ToggleLikeResponse struct {
	Liked     bool  `json:"liked"`
	LikeCount int64 `json:"likeCount"`
}

// POST /api/posts/:id/like
// Toggle lajk: ako korisnik već lajkuje post -> uklanja lajk, inače dodaje.
func TogglePostLike(c *gin.Context) {
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

	c.JSON(http.StatusOK, ToggleLikeResponse{
		Liked:     liked,
		LikeCount: likeCount,
	})
}

type CreateCommentRequest struct {
	Content string `json:"content" binding:"required"`
}

// GET /api/posts/:id/comments?limit=20&offset=0
func GetPostComments(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

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
		ID        uint   `json:"id"`
		Username  string `json:"username"`
		FullName  string `json:"fullName"`
		AvatarURL string `json:"avatarUrl,omitempty"`
	}

	type CommentDTO struct {
		ID        uint            `json:"id"`
		Content   string         `json:"content"`
		CreatedAt string         `json:"createdAt"`
		User      CommentUserDTO `json:"user"`
	}

	out := make([]CommentDTO, 0, len(comments))
	for _, cm := range comments {
		u := CommentUserDTO{}
		if cm.User != nil {
			u = CommentUserDTO{
				ID:        cm.User.ID,
				Username:  cm.User.Username,
				FullName:  cm.User.FullName,
				AvatarURL: cm.User.AvatarURL,
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

	db.Preload("User", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, username, full_name, avatar_url")
	}).First(&comment, comment.ID)

	c.JSON(http.StatusCreated, gin.H{
		"comment": gin.H{
			"id":        comment.ID,
			"content":   comment.Content,
			"createdAt": comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			"user": gin.H{
				"id":        comment.User.ID,
				"username":  comment.User.Username,
				"fullName":  comment.User.FullName,
				"avatarUrl": comment.User.AvatarURL,
			},
		},
	})
}
