package handlers

import (
	"errors"
	"net/http"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var errPostNotVisible = errors.New("post not visible")

// feedAllowedAuthorIDs mirrors GetPosts visibility: self ∪ club members ∪ accepted follows,
// excluding deleted users and anyone blocked either direction with the viewer.
func feedAllowedAuthorIDs(db *gorm.DB, currentUser models.Korisnik) []uint {
	allowedUserIDSet := map[uint]struct{}{
		currentUser.ID: {},
	}

	if currentUser.KlubID != nil {
		var clubUserIDs []uint
		if err := db.Model(&models.Korisnik{}).
			Where("klub_id = ? AND role <> ?", *currentUser.KlubID, "deleted").
			Pluck("id", &clubUserIDs).Error; err == nil {
			for _, id := range clubUserIDs {
				allowedUserIDSet[id] = struct{}{}
			}
		}
	}

	var acceptedFollowTargetIDs []uint
	_ = db.Model(&models.Follow{}).
		Joins("JOIN korisnici k ON k.id = follows.target_id").
		Where("follows.requester_id = ? AND follows.status = ? AND k.role <> ?", currentUser.ID, models.FollowStatusAccepted, "deleted").
		Pluck("target_id", &acceptedFollowTargetIDs).Error
	for _, id := range acceptedFollowTargetIDs {
		allowedUserIDSet[id] = struct{}{}
	}

	blocked := loadKorisniciBlockSet(db, currentUser.ID)
	allowedUserIDs := make([]uint, 0, len(allowedUserIDSet))
	for id := range allowedUserIDSet {
		if id != currentUser.ID {
			if _, ok := blocked[id]; ok {
				continue
			}
		}
		allowedUserIDs = append(allowedUserIDs, id)
	}
	return allowedUserIDs
}

func authorInFeedAllowList(allowed []uint, authorID uint) bool {
	for _, id := range allowed {
		if id == authorID {
			return true
		}
	}
	return false
}

// canViewerAccessFeedPost applies the same access rules as the feed list (+ block).
// Hidden / private / blocked posts return false without distinguishing the reason.
func canViewerAccessFeedPost(db *gorm.DB, viewer models.Korisnik, authorID uint) bool {
	if authorID == 0 {
		return false
	}
	if isBlockedEitherDirection(db, viewer.ID, authorID) {
		return false
	}
	return authorInFeedAllowList(feedAllowedAuthorIDs(db, viewer), authorID)
}

// getVisiblePostForViewer loads a post the viewer may see under feed+block policy.
// Missing, deleted author, out-of-allow-list, and block all map to errPostNotVisible.
func getVisiblePostForViewer(db *gorm.DB, viewer models.Korisnik, postID uint) (*models.Post, error) {
	if postID == 0 {
		return nil, errPostNotVisible
	}
	var post models.Post
	if err := db.First(&post, postID).Error; err != nil {
		return nil, errPostNotVisible
	}
	var author models.Korisnik
	if err := db.Select("id", "role").First(&author, post.UserID).Error; err != nil {
		return nil, errPostNotVisible
	}
	if author.Role == "deleted" {
		return nil, errPostNotVisible
	}
	if !canViewerAccessFeedPost(db, viewer, post.UserID) {
		return nil, errPostNotVisible
	}
	return &post, nil
}

func respondPostNotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{"error": "Objava nije pronađena"})
}

func isDuplicateKeyDBError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := err.Error()
	lower := ""
	for i := 0; i < len(msg); i++ {
		c := msg[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		lower += string(c)
	}
	return (containsASCII(lower, "unique") || containsASCII(lower, "duplicate") || containsASCII(lower, "23505")) &&
		(containsASCII(lower, "constraint") || containsASCII(lower, "idx_") || containsASCII(lower, "post_like"))
}

func containsASCII(s, sub string) bool {
	return len(s) >= len(sub) && (func() bool {
		for i := 0; i+len(sub) <= len(s); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
		return false
	})()
}
