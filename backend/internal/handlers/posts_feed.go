package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/internal/models"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var mentionRegex = regexp.MustCompile(`@([A-Za-z0-9_\.]{3,30})`)

func extractMentionUsernames(content string) []string {
	if content == "" {
		return nil
	}
	matches := mentionRegex.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(matches))
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		u := strings.ToLower(strings.TrimSpace(m[1]))
		if u == "" {
			continue
		}
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		out = append(out, u)
	}
	return out
}

// postClubID: obaveštenje o pomenima ide samo korisnicima istog kluba kao objava (ne drugi klubovi).
func notifyMentionsFromContent(db *gorm.DB, mentionUsernames []string, sender models.Korisnik, senderText string, selfUserID uint, postID uint, postClubID uint) {
	if len(mentionUsernames) == 0 || postClubID == 0 {
		return
	}

	// Mapiraj username -> userId (samo oni koji postoje)
	var users []models.Korisnik
	if err := db.Where("LOWER(username) IN ?", mentionUsernames).Find(&users).Error; err != nil {
		return
	}

	if len(users) == 0 {
		return
	}

	senderName := strings.TrimSpace(sender.FullName)
	if senderName == "" {
		senderName = sender.Username
	}

	runes := []rune(senderText)
	snippet := senderText
	if len(runes) > 120 {
		snippet = string(runes[:120]) + "..."
	}

	// Deduplikacija po UserID (da @username 2x ne pravi 2 notifikacije)
	uidSeen := make(map[uint]struct{}, len(users))
	for _, u := range users {
		if u.ID == selfUserID {
			continue
		}
		if u.KlubID == nil || *u.KlubID != postClubID {
			continue
		}
		if _, ok := uidSeen[u.ID]; ok {
			continue
		}
		uidSeen[u.ID] = struct{}{}

		meta := fmt.Sprintf(`{"postId":%d}`, postID)
		notifications.NotifyUsers(
			db,
			[]uint{u.ID},
			models.ObavestenjeTipPost,
			"Označen si",
			fmt.Sprintf("%s te je označio/la: %s", senderName, snippet),
			fmt.Sprintf("/korisnik/%s", u.Username),
			meta,
		)
	}
}

type CreatePostRequest struct {
	Content  string `json:"content"`
	ImageURL string `json:"imageUrl"`
}

type UpdatePostRequest struct {
	Content  *string `json:"content"`
	ImageURL *string `json:"imageUrl"`
}

func GetPosts(c *gin.Context) {
	db := DB(c)

	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username, _ := usernameVal.(string)

	var currentUser models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&currentUser).Error; err != nil {
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

	// Feed je kombinacija:
	// 1) svih članova istog kluba (ako korisnik ima klub)
	// 2) svih korisnika koje currentUser prati (follows.status = "accepted")
	allowedUserIDSet := map[uint]struct{}{
		currentUser.ID: {},
	}

	if currentUser.KlubID != nil {
		var clubUserIDs []uint
		if err := db.Model(&models.Korisnik{}).
			Where("klub_id = ?", *currentUser.KlubID).
			Pluck("id", &clubUserIDs).Error; err == nil {
			for _, id := range clubUserIDs {
				allowedUserIDSet[id] = struct{}{}
			}
		}
	}

	var acceptedFollowTargetIDs []uint
	_ = db.Model(&models.Follow{}).
		Where("requester_id = ? AND status = ?", currentUser.ID, models.FollowStatusAccepted).
		Pluck("target_id", &acceptedFollowTargetIDs).Error
	for _, id := range acceptedFollowTargetIDs {
		allowedUserIDSet[id] = struct{}{}
	}

	allowedUserIDs := make([]uint, 0, len(allowedUserIDSet))
	for id := range allowedUserIDSet {
		allowedUserIDs = append(allowedUserIDs, id)
	}

	var total int64
	db.Model(&models.Post{}).Where("user_id IN ?", allowedUserIDs).Count(&total)

	var posts []models.Post
	if err := db.
		Where("user_id IN ?", allowedUserIDs).
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
		ID           uint   `json:"id"`
		Username     string `json:"username"`
		FullName     string `json:"fullName"`
		AvatarURL    string `json:"avatarUrl,omitempty"`
		Role         string `json:"role"`
		KlubNaziv    string `json:"klubNaziv,omitempty"`
		IsProfiGuide bool   `json:"isProfiGuide,omitempty"`
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

	postUserIDs := make([]uint, 0, len(posts))
	for _, p := range posts {
		if p.User != nil && p.User.ID != 0 {
			postUserIDs = append(postUserIDs, p.User.ID)
		}
	}
	postProfiSet := helpers.ApprovedProfiGuideKorisnikIDs(db, postUserIDs)

	out := make([]PostDTO, 0, len(posts))
	for _, p := range posts {
		u := UserDTO{}
		if p.User != nil {
			u.ID = p.User.ID
			u.Username = p.User.Username
			u.FullName = p.User.FullName
			u.AvatarURL = p.User.AvatarURL
			u.Role = p.User.Role
			u.IsProfiGuide = postProfiSet[p.User.ID]
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

// GetPost vraća jednu objavu u istom formatu kao element liste feed-a.
func GetPost(c *gin.Context) {
	db := DB(c)

	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	username, _ := usernameVal.(string)

	var currentUser models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&currentUser).Error; err != nil {
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
	if err := db.
		Preload("User", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("id, username, full_name, avatar_url, role, klub_id")
		}).
		Preload("User.Klub", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("id, naziv, logo_url")
		}).
		First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Objava nije pronađena"})
		return
	}

	var likeCount int64
	db.Model(&models.PostLike{}).Where("post_id = ?", postID).Count(&likeCount)
	var commentCount int64
	db.Model(&models.PostComment{}).Where("post_id = ?", postID).Count(&commentCount)
	myLiked := false
	var existingLike models.PostLike
	if db.Where("post_id = ? AND user_id = ?", postID, currentUser.ID).First(&existingLike).Error == nil {
		myLiked = true
	}

	type UserDTO struct {
		ID           uint   `json:"id"`
		Username     string `json:"username"`
		FullName     string `json:"fullName"`
		AvatarURL    string `json:"avatarUrl,omitempty"`
		Role         string `json:"role"`
		KlubNaziv    string `json:"klubNaziv,omitempty"`
		IsProfiGuide bool   `json:"isProfiGuide,omitempty"`
	}
	u := UserDTO{}
	if post.User != nil {
		u.ID = post.User.ID
		u.Username = post.User.Username
		u.FullName = post.User.FullName
		u.AvatarURL = post.User.AvatarURL
		u.Role = post.User.Role
		u.IsProfiGuide = helpers.KorisnikIsApprovedProfiGuide(db, post.User.ID)
		if post.User.Klub != nil {
			u.KlubNaziv = post.User.Klub.Naziv
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"post": gin.H{
			"id":           post.ID,
			"content":      post.Content,
			"imageUrl":     post.ImageURL,
			"createdAt":    post.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			"user":         u,
			"likeCount":    likeCount,
			"commentCount": commentCount,
			"myLiked":      myLiked,
		},
	})
}

func CreatePost(c *gin.Context) {
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
		if len(content) > 3000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave je predugačak (maks. 3000 karaktera)"})
			return
		}

		files := c.Request.MultipartForm.File["image"]
		if len(files) > 0 {
			fileHeader := files[0]
			if err := helpers.ValidateImageFileHeader(fileHeader); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna slika: " + err.Error()})
				return
			}
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

		if content == "" && imageURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite tekst ili dodajte sliku"})
			return
		}
	} else {
		// json: content i/ili imageUrl
		var req CreatePostRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
			return
		}

		content = strings.TrimSpace(req.Content)
		imageURL = strings.TrimSpace(req.ImageURL)

		if content == "" && imageURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite tekst ili imageUrl sa slikom"})
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

	// Notifikuj označene (@username) u tekstu objave — samo članove istog kluba kao objava.
	mentions := extractMentionUsernames(content)
	notifyMentionsFromContent(db, mentions, korisnik, content, korisnik.ID, post.ID, clubID)

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
			"id":           post.User.ID,
			"username":     post.User.Username,
			"fullName":     post.User.FullName,
			"avatarUrl":    post.User.AvatarURL,
			"role":         post.User.Role,
			"klubNaziv":    klubNaziv,
			"isProfiGuide": helpers.KorisnikIsApprovedProfiGuide(db, post.User.ID),
		},
	}})
}

// PATCH /api/posts/:id
// Dozvoljeno: samo autor objave.
// Body: JSON { content?: string, imageUrl?: string }
func UpdatePost(c *gin.Context) {
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

	postID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID objave"})
		return
	}

	var post models.Post
	if err := db.Preload("User", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, username, full_name, avatar_url, role, klub_id")
	}).Preload("User.Klub", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, naziv, logo_url")
	}).First(&post, uint(postID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Objava nije pronađena"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju objave"})
		}
		return
	}

	if post.UserID != korisnik.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Možete izmeniti samo svoju objavu"})
		return
	}

	var req UpdatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći JSON"})
		return
	}
	if req.Content == nil && req.ImageURL == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nema izmena"})
		return
	}

	nextContent := post.Content
	nextImageURL := post.ImageURL
	if req.Content != nil {
		nextContent = strings.TrimSpace(*req.Content)
		if len(nextContent) > 3000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tekst objave je predugačak (maks. 3000 karaktera)"})
			return
		}
	}
	if req.ImageURL != nil {
		nextImageURL = strings.TrimSpace(*req.ImageURL)
	}

	if strings.TrimSpace(nextContent) == "" && strings.TrimSpace(nextImageURL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite tekst ili imageUrl sa slikom"})
		return
	}

	oldImage := post.ImageURL
	post.Content = nextContent
	post.ImageURL = nextImageURL

	if err := db.Save(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri izmeni objave"})
		return
	}

	// Ako je slika promenjena/uklonjena, zakaži brisanje stare Cloudinary slike.
	if oldImage != "" && oldImage != post.ImageURL {
		helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), oldImage)
	}

	likeCount := int64(0)
	commentCount := int64(0)
	_ = db.Model(&models.PostLike{}).Where("post_id = ?", post.ID).Count(&likeCount).Error
	_ = db.Model(&models.PostComment{}).Where("post_id = ?", post.ID).Count(&commentCount).Error

	// myLiked: za autora nije bitno, ali vrati realno stanje (po korisniku).
	myLiked := false
	var like models.PostLike
	if err := db.Where("post_id = ? AND user_id = ?", post.ID, korisnik.ID).First(&like).Error; err == nil {
		myLiked = true
	}

	klubNaziv := ""
	if post.User != nil && post.User.Klub != nil {
		klubNaziv = post.User.Klub.Naziv
	}

	c.JSON(http.StatusOK, gin.H{"post": gin.H{
		"id":           post.ID,
		"content":      post.Content,
		"imageUrl":     post.ImageURL,
		"createdAt":    post.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"user": gin.H{
			"id":        post.User.ID,
			"username":  post.User.Username,
			"fullName":  post.User.FullName,
			"avatarUrl": post.User.AvatarURL,
			"role":      post.User.Role,
			"klubNaziv": klubNaziv,
		},
		"likeCount":    likeCount,
		"commentCount": commentCount,
		"myLiked":      myLiked,
	}})
}

func DeletePost(c *gin.Context) {
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
