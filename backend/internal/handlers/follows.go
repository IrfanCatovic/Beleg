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
	// state:
	// - "none"
	// - "outgoing_pending"  (current user je requester, pending)
	// - "outgoing_accepted" (current user je requester, accepted)
	// - "incoming_pending"  (current user je target, pending)
	State    string `json:"state"`
	FollowID *uint  `json:"followId,omitempty"`
}

func getCurrentUser(c *gin.Context) (models.Korisnik, bool) {
	usernameVal, exists := c.Get("username")
	if !exists {
		return models.Korisnik{}, false
	}
	username, _ := usernameVal.(string)
	db := c.MustGet("db").(*gorm.DB)

	var currentUser models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&currentUser).Error; err != nil {
		return models.Korisnik{}, false
	}
	return currentUser, true
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
	if err := helpers.DBWhereUsername(db, helpers.NormalizeUsername(param)).First(&u).Error; err != nil {
		return models.Korisnik{}, false
	}
	if u.Role == "deleted" {
		return models.Korisnik{}, false
	}
	return u, true
}

// POST /api/follows/requests
// Kreira zahtev za praćenje (status = "pending").
func CreateFollowRequestHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

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

	var target models.Korisnik
	if err := db.First(&target, req.TargetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}
	if target.Role == "deleted" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	// Idempotentno: ako već postoji red za (requester,target), vraćamo ga.
	var existing models.Follow
	if err := db.Where("requester_id = ? AND target_id = ?", currentUser.ID, req.TargetID).First(&existing).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{"follow": existing})
		return
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri postojeće veze"})
		return
	}

	f := models.Follow{
		RequesterID: currentUser.ID,
		TargetID:    req.TargetID,
		Status:      models.FollowStatusPending,
	}
	if err := db.Create(&f).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju zahteva"})
		return
	}

	// Obaveštenje target korisniku: da može da prihvati/odbije iz Obaveštenja detalja.
	requesterName := currentUser.FullName
	if requesterName == "" {
		requesterName = currentUser.Username
	}
	meta := fmt.Sprintf(`{"followId":%d,"requesterId":%d,"requesterUsername":%q,"requesterFullName":%q}`, f.ID, currentUser.ID, currentUser.Username, currentUser.FullName)
	notifications.NotifyUsers(
		db,
		[]uint{target.ID},
		models.ObavestenjeTipFollow,
		"Novi zahtev za praćenje",
		fmt.Sprintf("%s želi da te zaprati.", requesterName),
		"",
		meta,
	)

	c.JSON(http.StatusCreated, gin.H{"follow": f})
}

// PATCH /api/follows/requests/:id/accept
// Ciljani korisnik prihvata zahtev => status = "accepted".
func AcceptFollowRequestHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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

	var f models.Follow
	if err := db.Where("id = ? AND target_id = ? AND status = ?", uint(followIDUint), currentUser.ID, models.FollowStatusPending).
		First(&f).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen ili više nije pending"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju zahteva"})
		return
	}

	if err := db.Model(&f).Update("status", models.FollowStatusAccepted).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri prihvatanju zahteva"})
		return
	}
	f.Status = models.FollowStatusAccepted

	// Obaveštenje requester-u: target (currentUser) je prihvatio.
	targetName := currentUser.FullName
	if targetName == "" {
		targetName = currentUser.Username
	}
	meta := fmt.Sprintf(`{"followId":%d,"targetId":%d,"targetUsername":%q,"targetFullName":%q}`, f.ID, currentUser.ID, currentUser.Username, currentUser.FullName)
	notifications.NotifyUsers(
		db,
		[]uint{f.RequesterID},
		models.ObavestenjeTipFollow,
		"Zahtev prihvaćen",
		fmt.Sprintf("%s je prihvatio/la tvoj zahtev za praćenje.", targetName),
		"",
		meta,
	)

	c.JSON(http.StatusOK, gin.H{"follow": f})
}

// DELETE /api/follows/requests/:id
// Odbijanje => samo briše pending red iz tabele.
func RejectFollowRequestHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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

	res := db.Where("id = ? AND target_id = ? AND status = ?", uint(followIDUint), currentUser.ID, models.FollowStatusPending).
		Delete(&models.Follow{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri odbijanju zahteva"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen ili više nije pending"})
		return
	}

	c.Status(http.StatusNoContent)
}

// DELETE /api/follows/user/:targetId
// Uklanja outgoing follow/request (pending ili accepted) od currentUser ka target-u.
func UnfollowUserHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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

	res := db.Where("requester_id = ? AND target_id = ?", currentUser.ID, targetID).Delete(&models.Follow{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otpraćivanju"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Veza praćenja nije pronađena"})
		return
	}

	c.Status(http.StatusNoContent)
}

// GET /api/follows/status/:targetId
// Vraca status odnosa između trenutnog korisnika (viewer) i target-a.
func GetFollowStatusHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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

	// 1) outgoing: currentUser (requester) -> target (target)
	var outgoing models.Follow
	if err := db.Where("requester_id = ? AND target_id = ?", currentUser.ID, targetID).First(&outgoing).Error; err == nil {
		resp := FollowStatusResponse{}
		switch outgoing.Status {
		case models.FollowStatusPending:
			resp.State = "outgoing_pending"
			resp.FollowID = &outgoing.ID
		case models.FollowStatusAccepted:
			resp.State = "outgoing_accepted"
			resp.FollowID = &outgoing.ID
		default:
			resp.State = "none"
		}
		c.JSON(http.StatusOK, resp)
		return
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri statusa"})
		return
	}

	// 2) incoming: target (requester) -> currentUser (target)
	var incoming models.Follow
	if err := db.Where("requester_id = ? AND target_id = ? AND status = ?", targetID, currentUser.ID, models.FollowStatusPending).
		First(&incoming).Error; err == nil {
		c.JSON(http.StatusOK, FollowStatusResponse{
			State:    "incoming_pending",
			FollowID: &incoming.ID,
		})
		return
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri statusa"})
		return
	}

	// 3) incoming accepted: target prati currentUser (zahtev je ranije prihvaćen)
	var incomingAccepted models.Follow
	if err := db.Where("requester_id = ? AND target_id = ? AND status = ?", targetID, currentUser.ID, models.FollowStatusAccepted).
		First(&incomingAccepted).Error; err == nil {
		c.JSON(http.StatusOK, FollowStatusResponse{
			State:    "incoming_accepted",
			FollowID: &incomingAccepted.ID,
		})
		return
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri statusa"})
		return
	}

	c.JSON(http.StatusOK, FollowStatusResponse{State: "none"})
}

type PendingFollowRequestDTO struct {
	FollowID   uint `json:"followId"`
	Requester  struct {
		ID        uint   `json:"id"`
		Username  string `json:"username"`
		FullName  string `json:"fullName"`
		AvatarURL string `json:"avatarUrl,omitempty"`
		Role      string `json:"role"`
		KlubNaziv string `json:"klubNaziv,omitempty"`
	} `json:"requester"`
	CreatedAt string `json:"createdAt"`
}

// GET /api/follows/requests/pending
// Lista pending zahteva koje currentUser prima (target).
func GetPendingIncomingFollowRequestsHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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

	out := make([]PendingFollowRequestDTO, 0, len(follows))
	for _, f := range follows {
		r, ok := requesterByID[f.RequesterID]
		if !ok {
			continue
		}

		dto := PendingFollowRequestDTO{
			FollowID:   f.ID,
			CreatedAt:  f.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			Requester: struct {
				ID        uint   `json:"id"`
				Username  string `json:"username"`
				FullName  string `json:"fullName"`
				AvatarURL string `json:"avatarUrl,omitempty"`
				Role      string `json:"role"`
				KlubNaziv string `json:"klubNaziv,omitempty"`
			}{
				ID:        r.ID,
				Username:  r.Username,
				FullName:  r.FullName,
				AvatarURL: r.AvatarURL,
				Role:      r.Role,
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
// :id može biti numeric id ili username. Broji samo accepted.
func GetFollowCountsHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	// zahteva auth (routes su protected), ali counts su vezani za target user
	target, ok := getUserByIDOrUsername(db, c.Param("id"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var following int64
	db.Model(&models.Follow{}).
		Where("requester_id = ? AND status = ?", target.ID, models.FollowStatusAccepted).
		Count(&following)

	var followers int64
	db.Model(&models.Follow{}).
		Where("target_id = ? AND status = ?", target.ID, models.FollowStatusAccepted).
		Count(&followers)

	c.JSON(http.StatusOK, FollowCountsResponse{Following: following, Followers: followers})
}

type FollowUserDTO struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	FullName  string `json:"fullName,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	Role      string `json:"role"`
	KlubNaziv string `json:"klubNaziv,omitempty"`
}

func toFollowUserDTO(u models.Korisnik) FollowUserDTO {
	dto := FollowUserDTO{
		ID:        u.ID,
		Username:  u.Username,
		FullName:  u.FullName,
		AvatarURL: u.AvatarURL,
		Role:      u.Role,
	}
	if u.Klub != nil {
		dto.KlubNaziv = u.Klub.Naziv
	}
	return dto
}

// GET /api/follows/user/:id/following
func GetFollowingListHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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
	if len(ids) == 0 {
		c.JSON(http.StatusOK, gin.H{"users": []FollowUserDTO{}})
		return
	}

	var users []models.Korisnik
	if err := db.Where("id IN ?", ids).Preload("Klub").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}

	byID := make(map[uint]models.Korisnik, len(users))
	for _, u := range users {
		byID[u.ID] = u
	}

	out := make([]FollowUserDTO, 0, len(ids))
	for _, id := range ids {
		u, ok := byID[id]
		if !ok {
			continue
		}
		out = append(out, toFollowUserDTO(u))
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}

// GET /api/follows/user/:id/followers
func GetFollowersListHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
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
	if len(ids) == 0 {
		c.JSON(http.StatusOK, gin.H{"users": []FollowUserDTO{}})
		return
	}

	var users []models.Korisnik
	if err := db.Where("id IN ?", ids).Preload("Klub").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}

	byID := make(map[uint]models.Korisnik, len(users))
	for _, u := range users {
		byID[u.ID] = u
	}

	out := make([]FollowUserDTO, 0, len(ids))
	for _, id := range ids {
		u, ok := byID[id]
		if !ok {
			continue
		}
		out = append(out, toFollowUserDTO(u))
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}

