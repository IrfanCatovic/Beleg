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

type CreateFollowRequest struct {
	TargetID uint `json:"targetId"`
}

type FollowStatusResponse struct {
	Outgoing         string `json:"outgoing"`                   // "none" | "pending" | "accepted"
	Incoming         string `json:"incoming"`                   // "none" | "pending" | "accepted"
	OutgoingFollowID *uint  `json:"outgoingFollowId,omitempty"` // ID reda gde currentUser → target
	IncomingFollowID *uint  `json:"incomingFollowId,omitempty"` // ID reda gde target → currentUser
}

type BlockStatusResponse struct {
	BlockedByMe     bool `json:"blockedByMe"`
	BlockedByTarget bool `json:"blockedByTarget"`
}

func getCurrentUser(c *gin.Context) (models.Korisnik, bool) {
	return CurrentUser(c)
}

func getUserByIDOrUsername(db *gorm.DB, param string) (models.Korisnik, bool) {
	param = strings.TrimSpace(param)
	if param == "" {
		return models.Korisnik{}, false
	}
	// numeric id?
	if id, err := strconv.ParseUint(param, 10, 32); err == nil && id > 0 {
		var u models.Korisnik
		if err := db.First(&u, uint(id)).Error; err != nil {
			return models.Korisnik{}, false
		}
		if u.Role == "deleted" {
			return models.Korisnik{}, false
		}
		return u, true
	}
	// username
	var u models.Korisnik
	if err := helpers.DBWhereUsername(db, param).First(&u).Error; err != nil {
		return models.Korisnik{}, false
	}
	if u.Role == "deleted" {
		return models.Korisnik{}, false
	}
	return u, true
}

func isBlockedEitherDirection(db *gorm.DB, a, b uint) bool {
	if a == 0 || b == 0 {
		return false
	}
	var cnt int64
	_ = db.Model(&models.Block{}).
		Where("(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", a, b, b, a).
		Count(&cnt).Error
	return cnt > 0
}

func neutralFollowStatusResponse() FollowStatusResponse {
	return FollowStatusResponse{Outgoing: "none", Incoming: "none"}
}

func buildFollowUserList(db *gorm.DB, orderedIDs []uint, viewerID uint) ([]FollowUserDTO, error) {
	if len(orderedIDs) == 0 {
		return []FollowUserDTO{}, nil
	}

	blockedSet := loadKorisniciBlockSet(db, viewerID)

	var users []models.Korisnik
	if err := db.Where("id IN ? AND role != ?", orderedIDs, "deleted").Preload("Klub").Find(&users).Error; err != nil {
		return nil, err
	}
	byID := make(map[uint]models.Korisnik, len(users))
	visibleIDs := make([]uint, 0, len(orderedIDs))
	for _, u := range users {
		byID[u.ID] = u
	}
	for _, id := range orderedIDs {
		if _, blocked := blockedSet[id]; blocked {
			continue
		}
		if _, ok := byID[id]; !ok {
			continue
		}
		visibleIDs = append(visibleIDs, id)
	}

	profiSet := helpers.ApprovedProfiGuideKorisnikIDs(db, visibleIDs)
	out := make([]FollowUserDTO, 0, len(visibleIDs))
	for _, id := range visibleIDs {
		out = append(out, toFollowUserDTO(byID[id], profiSet))
	}
	return out, nil
}

func countVisibleFollowing(db *gorm.DB, targetID, viewerID uint) int64 {
	q := db.Model(&models.Follow{}).
		Joins("JOIN korisnici k ON k.id = follows.target_id").
		Where("follows.requester_id = ? AND follows.status = ? AND k.role <> ?", targetID, models.FollowStatusAccepted, "deleted")
	if viewerID > 0 {
		q = q.Where(`NOT EXISTS (
			SELECT 1 FROM blocks b
			WHERE (b.blocker_id = ? AND b.blocked_id = k.id) OR (b.blocker_id = k.id AND b.blocked_id = ?)
		)`, viewerID, viewerID)
	}
	var count int64
	_ = q.Count(&count).Error
	return count
}

func countVisibleFollowers(db *gorm.DB, targetID, viewerID uint) int64 {
	q := db.Model(&models.Follow{}).
		Joins("JOIN korisnici k ON k.id = follows.requester_id").
		Where("follows.target_id = ? AND follows.status = ? AND k.role <> ?", targetID, models.FollowStatusAccepted, "deleted")
	if viewerID > 0 {
		q = q.Where(`NOT EXISTS (
			SELECT 1 FROM blocks b
			WHERE (b.blocker_id = ? AND b.blocked_id = k.id) OR (b.blocker_id = k.id AND b.blocked_id = ?)
		)`, viewerID, viewerID)
	}
	var count int64
	_ = q.Count(&count).Error
	return count
}

// POST /api/follows/requests
// Kreira zahtev za praćenje (status = "pending").
func CreateFollowRequestHandler(c *gin.Context) {
	db := DB(c)

	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	var req CreateFollowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}
	if req.TargetID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "TargetID je obavezan"})
		return
	}
	if req.TargetID == currentUser.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete pratiti sami sebe"})
		return
	}

	type followCreateOutcome struct {
		existing bool
		created  bool
		follow   models.Follow
		target   models.Korisnik
	}
	var outcome followCreateOutcome

	var err error
	for attempt := 0; attempt < 5; attempt++ {
		outcome = followCreateOutcome{}
		err = db.Transaction(func(tx *gorm.DB) error {
			if err := lockUserPair(tx, currentUser.ID, req.TargetID); err != nil {
				if errors.Is(err, errFollowSelf) {
					return errFollowSelf
				}
				if errors.Is(err, errUserPairNotFound) || errors.Is(err, errUserPairDeleted) {
					return gorm.ErrRecordNotFound
				}
				return err
			}
			if isBlockedEitherDirectionTx(tx, currentUser.ID, req.TargetID) {
				return errFollowBlocked
			}

			var existing models.Follow
			if err := tx.Where("requester_id = ? AND target_id = ?", currentUser.ID, req.TargetID).First(&existing).Error; err == nil {
				outcome.existing = true
				outcome.follow = existing
				return nil
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			f := models.Follow{
				RequesterID: currentUser.ID,
				TargetID:    req.TargetID,
				Status:      models.FollowStatusPending,
			}
			if err := tx.Create(&f).Error; err != nil {
				return err
			}
			outcome.created = true
			outcome.follow = f

			var target models.Korisnik
			if err := tx.First(&target, req.TargetID).Error; err != nil {
				return err
			}
			outcome.target = target
			return nil
		})
		if err == nil || !isDeadlockError(err) {
			break
		}
	}
	if isDeadlockError(err) {
		if isBlockedEitherDirection(db, currentUser.ID, req.TargetID) {
			err = errFollowBlocked
		} else {
			var existing models.Follow
			if db.Where("requester_id = ? AND target_id = ?", currentUser.ID, req.TargetID).First(&existing).Error == nil {
				outcome.existing = true
				outcome.follow = existing
				err = nil
			}
		}
	}

	if err != nil {
		switch {
		case errors.Is(err, errFollowSelf):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete pratiti sami sebe"})
		case errors.Is(err, errFollowBlocked):
			c.JSON(http.StatusForbidden, gin.H{"error": "Nije moguće pratiti korisnika zbog blokade"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju zahteva"})
		}
		return
	}

	if outcome.existing {
		c.JSON(http.StatusOK, gin.H{"follow": outcome.follow})
		return
	}

	requesterName := currentUser.FullName
	if requesterName == "" {
		requesterName = currentUser.Username
	}
	meta := notifications.ProfileNotificationMetadata(currentUser.ID, currentUser.Username, map[string]any{
		"followId":          outcome.follow.ID,
		"requesterId":       currentUser.ID,
		"requesterUsername": currentUser.Username,
		"requesterFullName": currentUser.FullName,
	})
	notifications.NotifyUsers(
		db,
		[]uint{outcome.target.ID},
		models.ObavestenjeTipFollow,
		"Novi zahtev za praćenje",
		fmt.Sprintf("%s želi da te zaprati.", requesterName),
		notifications.BuildProfileNotificationLink(currentUser.Username),
		notifications.MarshalMetadata(meta),
	)

	c.JSON(http.StatusCreated, gin.H{"follow": outcome.follow})
}

// PATCH /api/follows/requests/:id/accept
// Ciljani korisnik prihvata zahtev => status = "accepted".
func AcceptFollowRequestHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	idStr := c.Param("id")
	followIDUint, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći follow zahtev"})
		return
	}

	type acceptOutcome struct {
		accepted    bool
		idempotent  bool
		follow      models.Follow
	}
	var outcome acceptOutcome

	for attempt := 0; attempt < 5; attempt++ {
		err = db.Transaction(func(tx *gorm.DB) error {
			var pending models.Follow
			if err := tx.Where("id = ? AND target_id = ? AND status = ?", uint(followIDUint), currentUser.ID, models.FollowStatusPending).
				First(&pending).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					var accepted models.Follow
					if err2 := tx.Where("id = ? AND target_id = ? AND status = ?", uint(followIDUint), currentUser.ID, models.FollowStatusAccepted).
						First(&accepted).Error; err2 == nil {
						outcome.idempotent = true
						outcome.follow = accepted
						return nil
					}
				}
				return err
			}

			if err := lockUserPair(tx, pending.RequesterID, currentUser.ID); err != nil {
				if errors.Is(err, errUserPairDeleted) || errors.Is(err, errUserPairNotFound) {
					return gorm.ErrRecordNotFound
				}
				return err
			}

			if isBlockedEitherDirectionTx(tx, pending.RequesterID, currentUser.ID) {
				_ = deleteFollowsBetweenUsers(tx, pending.RequesterID, currentUser.ID)
				return gorm.ErrRecordNotFound
			}

			res := tx.Model(&models.Follow{}).
				Where("id = ? AND status = ?", pending.ID, models.FollowStatusPending).
				Update("status", models.FollowStatusAccepted)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				var accepted models.Follow
				if err := tx.Where("id = ? AND target_id = ? AND status = ?", pending.ID, currentUser.ID, models.FollowStatusAccepted).
					First(&accepted).Error; err == nil {
					outcome.idempotent = true
					outcome.follow = accepted
					return nil
				}
				return gorm.ErrRecordNotFound
			}

			outcome.accepted = true
			outcome.follow = pending
			outcome.follow.Status = models.FollowStatusAccepted
			return nil
		})
		if err == nil || !isDeadlockError(err) {
			break
		}
	}
	if isDeadlockError(err) {
		err = gorm.ErrRecordNotFound
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen ili više nije pending"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri prihvatanju zahteva"})
		return
	}

	if outcome.accepted {
		targetName := currentUser.FullName
		if targetName == "" {
			targetName = currentUser.Username
		}
		meta := notifications.ProfileNotificationMetadata(currentUser.ID, currentUser.Username, map[string]any{
			"followId":       outcome.follow.ID,
			"targetId":       currentUser.ID,
			"targetUsername": currentUser.Username,
			"targetFullName": currentUser.FullName,
		})
		notifications.NotifyUsers(
			db,
			[]uint{outcome.follow.RequesterID},
			models.ObavestenjeTipFollow,
			"Zahtev prihvaćen",
			fmt.Sprintf("%s je prihvatio/la tvoj zahtev za praćenje.", targetName),
			notifications.BuildProfileNotificationLink(currentUser.Username),
			notifications.MarshalMetadata(meta),
		)
	}

	c.JSON(http.StatusOK, gin.H{"follow": outcome.follow})
}

// DELETE /api/follows/requests/:id
// Odbijanje => samo briše pending red iz tabele.
func RejectFollowRequestHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	idStr := c.Param("id")
	followIDUint, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći follow zahtev"})
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		var pending models.Follow
		if err := tx.Where("id = ? AND target_id = ? AND status = ?", uint(followIDUint), currentUser.ID, models.FollowStatusPending).
			First(&pending).Error; err != nil {
			return err
		}
		if err := lockUserPair(tx, pending.RequesterID, currentUser.ID); err != nil {
			if errors.Is(err, errUserPairDeleted) || errors.Is(err, errUserPairNotFound) {
				return gorm.ErrRecordNotFound
			}
			return err
		}
		res := tx.Where("id = ? AND target_id = ? AND status = ?", uint(followIDUint), currentUser.ID, models.FollowStatusPending).
			Delete(&models.Follow{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen ili više nije pending"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri odbijanju zahteva"})
		return
	}

	c.Status(http.StatusNoContent)
}

// DELETE /api/follows/user/:targetId
// Uklanja outgoing follow/request (pending ili accepted) od currentUser ka target-u.
func UnfollowUserHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	targetIDStr := c.Param("targetId")
	targetIDUint, err := strconv.ParseUint(targetIDStr, 10, 32)
	if err != nil || targetIDUint == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći targetId"})
		return
	}
	targetID := uint(targetIDUint)
	if targetID == currentUser.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete otpratiti sebe"})
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := lockUserPair(tx, currentUser.ID, targetID); err != nil {
			if errors.Is(err, errFollowSelf) {
				return errFollowSelf
			}
			if errors.Is(err, errUserPairNotFound) || errors.Is(err, errUserPairDeleted) {
				return gorm.ErrRecordNotFound
			}
			return err
		}
		res := tx.Where("requester_id = ? AND target_id = ?", currentUser.ID, targetID).Delete(&models.Follow{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})

	if err != nil {
		switch {
		case errors.Is(err, errFollowSelf):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete otpratiti sebe"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Veza praćenja nije pronađena"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otpraćivanju"})
		}
		return
	}

	c.Status(http.StatusNoContent)
}

// POST /api/blocks/:targetId
func BlockUserHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	targetIDUint, err := strconv.ParseUint(c.Param("targetId"), 10, 32)
	if err != nil || targetIDUint == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći targetId"})
		return
	}
	targetID := uint(targetIDUint)
	if targetID == currentUser.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete blokirati sebe"})
		return
	}

	var blockResult models.Block

	for attempt := 0; attempt < 5; attempt++ {
		err = db.Transaction(func(tx *gorm.DB) error {
			if err := lockUserPair(tx, currentUser.ID, targetID); err != nil {
				if errors.Is(err, errFollowSelf) {
					return errFollowSelf
				}
				if errors.Is(err, errUserPairNotFound) || errors.Is(err, errUserPairDeleted) {
					return gorm.ErrRecordNotFound
				}
				return err
			}

			var existing models.Block
			if err := tx.Where("blocker_id = ? AND blocked_id = ?", currentUser.ID, targetID).First(&existing).Error; err == nil {
				blockResult = existing
			} else if errors.Is(err, gorm.ErrRecordNotFound) {
				blockResult = models.Block{BlockerID: currentUser.ID, BlockedID: targetID}
				if err := tx.Create(&blockResult).Error; err != nil {
					return err
				}
			} else {
				return err
			}

			return deleteFollowsBetweenUsers(tx, currentUser.ID, targetID)
		})
		if err == nil || !isDeadlockError(err) {
			break
		}
	}
	if isDeadlockError(err) {
		var existing models.Block
		if db.Where("blocker_id = ? AND blocked_id = ?", currentUser.ID, targetID).First(&existing).Error == nil {
			blockResult = existing
			_ = deleteFollowsBetweenUsers(db, currentUser.ID, targetID)
			err = nil
		}
	}

	if err != nil {
		switch {
		case errors.Is(err, errFollowSelf):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete blokirati sebe"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri blokiranju korisnika"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"block": blockResult})
}

// DELETE /api/blocks/:targetId
func UnblockUserHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	targetIDUint, err := strconv.ParseUint(c.Param("targetId"), 10, 32)
	if err != nil || targetIDUint == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći targetId"})
		return
	}
	targetID := uint(targetIDUint)

	err = db.Transaction(func(tx *gorm.DB) error {
		if targetID != currentUser.ID {
			_ = lockUserPair(tx, currentUser.ID, targetID)
		}
		res := tx.Where("blocker_id = ? AND blocked_id = ?", currentUser.ID, targetID).Delete(&models.Block{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije blokiran"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri uklanjanju blokade"})
		return
	}
	c.Status(http.StatusNoContent)
}

// GET /api/blocks/status/:targetId
func GetBlockStatusHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	targetIDUint, err := strconv.ParseUint(c.Param("targetId"), 10, 32)
	if err != nil || targetIDUint == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći targetId"})
		return
	}
	targetID := uint(targetIDUint)
	var byMe int64
	_ = db.Model(&models.Block{}).Where("blocker_id = ? AND blocked_id = ?", currentUser.ID, targetID).Count(&byMe).Error
	var byTarget int64
	_ = db.Model(&models.Block{}).Where("blocker_id = ? AND blocked_id = ?", targetID, currentUser.ID).Count(&byTarget).Error
	c.JSON(http.StatusOK, BlockStatusResponse{BlockedByMe: byMe > 0, BlockedByTarget: byTarget > 0})
}

// GET /api/blocks/mine
func GetMyBlockedUsersHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	var blockedIDs []uint
	if err := db.Model(&models.Block{}).
		Where("blocker_id = ?", currentUser.ID).
		Order("created_at DESC").
		Pluck("blocked_id", &blockedIDs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju blok liste"})
		return
	}
	if len(blockedIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"users": []FollowUserDTO{}})
		return
	}

	var users []models.Korisnik
	if err := db.Where("id IN ? AND role != ?", blockedIDs, "deleted").Preload("Klub").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}
	byID := make(map[uint]models.Korisnik, len(users))
	for _, u := range users {
		byID[u.ID] = u
	}
	blockUserIDs := make([]uint, 0, len(users))
	for _, u := range users {
		blockUserIDs = append(blockUserIDs, u.ID)
	}
	blockProfiSet := helpers.ApprovedProfiGuideKorisnikIDs(db, blockUserIDs)

	out := make([]FollowUserDTO, 0, len(blockedIDs))
	for _, id := range blockedIDs {
		u, ok := byID[id]
		if !ok {
			continue
		}
		out = append(out, toFollowUserDTO(u, blockProfiSet))
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}

// GET /api/follows/status/:targetId
// Vraca status odnosa između trenutnog korisnika (viewer) i target-a.
func GetFollowStatusHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	targetIDStr := c.Param("targetId")
	targetIDUint, err := strconv.ParseUint(targetIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći targetId"})
		return
	}
	targetID := uint(targetIDUint)

	if isBlockedEitherDirection(db, currentUser.ID, targetID) {
		c.JSON(http.StatusOK, neutralFollowStatusResponse())
		return
	}

	resp := neutralFollowStatusResponse()

	// outgoing: currentUser → target
	var outgoing models.Follow
	if err := db.Where("requester_id = ? AND target_id = ?", currentUser.ID, targetID).First(&outgoing).Error; err == nil {
		resp.Outgoing = outgoing.Status
		resp.OutgoingFollowID = &outgoing.ID
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri statusa"})
		return
	}

	// incoming: target → currentUser
	var incoming models.Follow
	if err := db.Where("requester_id = ? AND target_id = ?", targetID, currentUser.ID).First(&incoming).Error; err == nil {
		resp.Incoming = incoming.Status
		resp.IncomingFollowID = &incoming.ID
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri statusa"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

type PendingFollowRequestDTO struct {
	FollowID  uint `json:"followId"`
	Requester struct {
		ID           uint   `json:"id"`
		Username     string `json:"username"`
		FullName     string `json:"fullName"`
		AvatarURL    string `json:"avatarUrl,omitempty"`
		Role         string `json:"role"`
		KlubNaziv    string `json:"klubNaziv,omitempty"`
		IsProfiGuide bool   `json:"isProfiGuide,omitempty"`
	} `json:"requester"`
	CreatedAt string `json:"createdAt"`
}

// GET /api/follows/requests/pending
// Lista pending zahteva koje currentUser prima (target).
func GetPendingIncomingFollowRequestsHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	var follows []models.Follow
	if err := db.Where("target_id = ? AND status = ?", currentUser.ID, models.FollowStatusPending).
		Order("created_at DESC").
		Find(&follows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju pending zahteva"})
		return
	}

	if len(follows) == 0 {
		c.JSON(http.StatusOK, gin.H{"requests": []PendingFollowRequestDTO{}})
		return
	}

	requesterIDs := make([]uint, 0, len(follows))
	seen := make(map[uint]struct{}, len(follows))
	for _, f := range follows {
		if _, ok := seen[f.RequesterID]; ok {
			continue
		}
		seen[f.RequesterID] = struct{}{}
		requesterIDs = append(requesterIDs, f.RequesterID)
	}

	var requesters []models.Korisnik
	if err := db.
		Where("id IN ?", requesterIDs).
		Preload("Klub").
		Find(&requesters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}

	requesterByID := make(map[uint]models.Korisnik, len(requesters))
	for _, r := range requesters {
		requesterByID[r.ID] = r
	}

	pendingProfiSet := helpers.ApprovedProfiGuideKorisnikIDs(db, requesterIDs)

	out := make([]PendingFollowRequestDTO, 0, len(follows))
	for _, f := range follows {
		r, ok := requesterByID[f.RequesterID]
		if !ok {
			continue
		}

		dto := PendingFollowRequestDTO{
			FollowID:  f.ID,
			CreatedAt: f.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			Requester: struct {
				ID           uint   `json:"id"`
				Username     string `json:"username"`
				FullName     string `json:"fullName"`
				AvatarURL    string `json:"avatarUrl,omitempty"`
				Role         string `json:"role"`
				KlubNaziv    string `json:"klubNaziv,omitempty"`
				IsProfiGuide bool   `json:"isProfiGuide,omitempty"`
			}{
				ID:           r.ID,
				Username:     r.Username,
				FullName:     r.FullName,
				AvatarURL:    r.AvatarURL,
				Role:         r.Role,
				IsProfiGuide: pendingProfiSet[r.ID],
			},
		}
		if r.Klub != nil {
			dto.Requester.KlubNaziv = r.Klub.Naziv
		}
		out = append(out, dto)
	}

	c.JSON(http.StatusOK, gin.H{"requests": out})
}

type FollowCountsResponse struct {
	Following int64 `json:"following"`
	Followers int64 `json:"followers"`
}

// GET /api/follows/user/:id/counts
// :id može biti numeric id ili username. Broji samo accepted, vidljive viewer-u.
func GetFollowCountsHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	target, ok := getUserByIDOrUsername(db, c.Param("id"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	following := countVisibleFollowing(db, target.ID, currentUser.ID)
	followers := countVisibleFollowers(db, target.ID, currentUser.ID)

	c.JSON(http.StatusOK, FollowCountsResponse{Following: following, Followers: followers})
}

type FollowUserDTO struct {
	ID           uint   `json:"id"`
	Username     string `json:"username"`
	FullName     string `json:"fullName,omitempty"`
	AvatarURL    string `json:"avatarUrl,omitempty"`
	Role         string `json:"role"`
	KlubNaziv    string `json:"klubNaziv,omitempty"`
	IsProfiGuide bool   `json:"isProfiGuide,omitempty"`
}

func toFollowUserDTO(u models.Korisnik, profiSet map[uint]bool) FollowUserDTO {
	dto := FollowUserDTO{
		ID:           u.ID,
		Username:     u.Username,
		FullName:     u.FullName,
		AvatarURL:    u.AvatarURL,
		Role:         u.Role,
		IsProfiGuide: profiSet[u.ID],
	}
	if u.Klub != nil {
		dto.KlubNaziv = u.Klub.Naziv
	}
	return dto
}

// GET /api/follows/user/:id/following
func GetFollowingListHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	target, ok := getUserByIDOrUsername(db, c.Param("id"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var ids []uint
	if err := db.Model(&models.Follow{}).
		Where("requester_id = ? AND status = ?", target.ID, models.FollowStatusAccepted).
		Order("created_at DESC").
		Pluck("target_id", &ids).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju liste"})
		return
	}

	out, err := buildFollowUserList(db, ids, currentUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}

// GET /api/follows/user/:id/followers
func GetFollowersListHandler(c *gin.Context) {
	db := DB(c)
	currentUser, ok := getCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	target, ok := getUserByIDOrUsername(db, c.Param("id"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var ids []uint
	if err := db.Model(&models.Follow{}).
		Where("target_id = ? AND status = ?", target.ID, models.FollowStatusAccepted).
		Order("created_at DESC").
		Pluck("requester_id", &ids).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju liste"})
		return
	}

	out, err := buildFollowUserList(db, ids, currentUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}
