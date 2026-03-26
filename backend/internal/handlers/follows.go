package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

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

