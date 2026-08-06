package handlers

import (
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func blockedUserIDSlice(blocked map[uint]struct{}) []uint {
	if len(blocked) == 0 {
		return nil
	}
	out := make([]uint, 0, len(blocked))
	for id := range blocked {
		out = append(out, id)
	}
	return out
}

// scopeVisibleEngagementActors restricts engagement rows to non-deleted users
// who are not blocked either direction with the viewer.
func scopeVisibleEngagementActors(db *gorm.DB, viewerID uint, userIDColumn string) *gorm.DB {
	// Block lookup must not inherit a prior Model()/Table (e.g. post_comments).
	blockedIDs := blockedUserIDSlice(loadKorisniciBlockSet(db.Session(&gorm.Session{NewDB: true}), viewerID))
	q := db.Joins("JOIN korisnici k ON k.id = "+userIDColumn).
		Where("k.role <> ?", "deleted")
	if len(blockedIDs) > 0 {
		q = q.Where(userIDColumn+" NOT IN ?", blockedIDs)
	}
	return q
}

func countVisibleCommentsForViewer(db *gorm.DB, viewerID uint, postID uint) int64 {
	var n int64
	q := scopeVisibleEngagementActors(db.Model(&models.PostComment{}), viewerID, "post_comments.user_id").
		Where("post_comments.post_id = ?", postID)
	_ = q.Count(&n).Error
	return n
}

func countVisibleLikesForViewer(db *gorm.DB, viewerID uint, postID uint) int64 {
	var n int64
	q := scopeVisibleEngagementActors(db.Model(&models.PostLike{}), viewerID, "post_likes.user_id").
		Where("post_likes.post_id = ?", postID)
	_ = q.Count(&n).Error
	return n
}

func countVisibleCommentsByPostIDs(db *gorm.DB, viewerID uint, postIDs []uint) map[uint]int64 {
	out := make(map[uint]int64, len(postIDs))
	if len(postIDs) == 0 {
		return out
	}
	type row struct {
		PostID uint
		Cnt    int64
	}
	var rows []row
	q := scopeVisibleEngagementActors(db.Model(&models.PostComment{}), viewerID, "post_comments.user_id").
		Select("post_comments.post_id as post_id, count(*) as cnt").
		Where("post_comments.post_id IN ?", postIDs).
		Group("post_comments.post_id")
	_ = q.Scan(&rows).Error
	for _, r := range rows {
		out[r.PostID] = r.Cnt
	}
	return out
}

func countVisibleLikesByPostIDs(db *gorm.DB, viewerID uint, postIDs []uint) map[uint]int64 {
	out := make(map[uint]int64, len(postIDs))
	if len(postIDs) == 0 {
		return out
	}
	type row struct {
		PostID uint
		Cnt    int64
	}
	var rows []row
	q := scopeVisibleEngagementActors(db.Model(&models.PostLike{}), viewerID, "post_likes.user_id").
		Select("post_likes.post_id as post_id, count(*) as cnt").
		Where("post_likes.post_id IN ?", postIDs).
		Group("post_likes.post_id")
	_ = q.Scan(&rows).Error
	for _, r := range rows {
		out[r.PostID] = r.Cnt
	}
	return out
}

// ensurePostStillExists returns errPostNotVisible when the post row is gone.
func ensurePostStillExists(tx *gorm.DB, postID uint) error {
	var n int64
	if err := tx.Model(&models.Post{}).Where("id = ?", postID).Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		return errPostNotVisible
	}
	return nil
}
