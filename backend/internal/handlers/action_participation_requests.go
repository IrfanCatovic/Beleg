package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	errActionParticipationForbidden      = errors.New("action participation forbidden")
	errActionParticipationNotCompleted   = errors.New("action participation action not completed")
	errActionParticipationPendingExists  = errors.New("action participation pending exists")
	errActionParticipationSameClub       = errors.New("action participation same club")
	errActionParticipationSelfRequest    = errors.New("action participation self request")
	errActionParticipationAlreadyHandled = errors.New("action participation already handled")
)

type actionParticipationRequestDTO struct {
	ID          uint       `json:"id"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	RespondedAt *time.Time `json:"respondedAt,omitempty"`
	Action      gin.H      `json:"action"`
	TargetUser  gin.H      `json:"targetUser"`
	RequestedBy gin.H      `json:"requestedBy"`
}

type externalUserCandidateDTO struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	FullName  string `json:"fullName,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	KlubID    *uint  `json:"klubId,omitempty"`
	KlubNaziv string `json:"klubNaziv,omitempty"`
}

func buildActionParticipationRequestDTO(req models.ActionParticipationRequest) actionParticipationRequestDTO {
	actionPayload := gin.H{
		"id":          req.Akcija.ID,
		"naziv":       req.Akcija.Naziv,
		"datum":       req.Akcija.Datum,
		"planina":     req.Akcija.Planina,
		"vrh":         req.Akcija.Vrh,
		"klubId":      req.Akcija.KlubID,
		"isCompleted": req.Akcija.IsCompleted,
	}
	if req.Akcija.Klub != nil {
		actionPayload["klubNaziv"] = req.Akcija.Klub.Naziv
	}

	targetPayload := gin.H{
		"id":        req.TargetUser.ID,
		"username":  req.TargetUser.Username,
		"fullName":  req.TargetUser.FullName,
		"avatarUrl": req.TargetUser.AvatarURL,
		"klubId":    req.TargetUser.KlubID,
	}
	if req.TargetUser.Klub != nil {
		targetPayload["klubNaziv"] = req.TargetUser.Klub.Naziv
	}

	requestedByPayload := gin.H{
		"id":        req.RequestedBy.ID,
		"username":  req.RequestedBy.Username,
		"fullName":  req.RequestedBy.FullName,
		"avatarUrl": req.RequestedBy.AvatarURL,
		"klubId":    req.RequestedBy.KlubID,
	}
	if req.RequestedBy.Klub != nil {
		requestedByPayload["klubNaziv"] = req.RequestedBy.Klub.Naziv
	}

	return actionParticipationRequestDTO{
		ID:          req.ID,
		Status:      req.Status,
		CreatedAt:   req.CreatedAt,
		UpdatedAt:   req.UpdatedAt,
		RespondedAt: req.RespondedAt,
		Action:      actionPayload,
		TargetUser:  targetPayload,
		RequestedBy: requestedByPayload,
	}
}

func createActionParticipationRequestNotification(db *gorm.DB, req models.ActionParticipationRequest) {
	requesterName := strings.TrimSpace(req.RequestedBy.FullName)
	if requesterName == "" {
		requesterName = strings.TrimSpace(req.RequestedBy.Username)
	}
	if requesterName == "" {
		requesterName = "organizator"
	}
	actionName := strings.TrimSpace(req.Akcija.Naziv)
	if actionName == "" {
		actionName = "završenu akciju"
	}
	clubName := ""
	if req.Akcija.Klub != nil {
		clubName = strings.TrimSpace(req.Akcija.Klub.Naziv)
	}
	title := "Zahtev za potvrdu učešća na akciji"
	body := requesterName + " vas poziva da potvrdite učešće na akciji \"" + actionName + "\"."
	if clubName != "" {
		body += " Klub domaćin: " + clubName + "."
	}
	metaMap := map[string]any{
		"requestId":         req.ID,
		"akcijaId":          req.Akcija.ID,
		"akcijaNaziv":       req.Akcija.Naziv,
		"requesterId":       req.RequestedBy.ID,
		"requesterUsername": req.RequestedBy.Username,
		"requesterFullName": req.RequestedBy.FullName,
		"hostClubName":      clubName,
	}
	metaBytes, _ := json.Marshal(metaMap)
	notifications.NotifyUsers(
		db,
		[]uint{req.TargetUserID},
		models.ObavestenjeTipActionParticipationRequest,
		title,
		body,
		"",
		string(metaBytes),
	)
}

func getCurrentKorisnik(c *gin.Context, db *gorm.DB) (*models.Korisnik, error) {
	usernameVal, exists := c.Get("username")
	if !exists {
		return nil, gorm.ErrRecordNotFound
	}
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(usernameVal)).First(&korisnik).Error; err != nil {
		return nil, err
	}
	return &korisnik, nil
}

func loadActionParticipationRequestWithRelations(db *gorm.DB, requestID uint) (*models.ActionParticipationRequest, error) {
	var req models.ActionParticipationRequest
	if err := db.
		Preload("Akcija").
		Preload("Akcija.Klub").
		Preload("TargetUser").
		Preload("TargetUser.Klub").
		Preload("RequestedBy").
		Preload("RequestedBy.Klub").
		First(&req, requestID).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

func SearchEligibleExternalUsers(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	actionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var akcija models.Akcija
	if err := db.Preload("Klub").First(&akcija, actionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da pretražuje korisnike"})
		return
	}
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Spoljni korisnici mogu se dodavati tek kada je akcija završena"})
		return
	}

	scope := strings.TrimSpace(strings.ToLower(c.DefaultQuery("scope", "other-clubs")))
	if scope != "other-clubs" && scope != "no-club" {
		scope = "other-clubs"
	}
	query := strings.TrimSpace(c.Query("q"))
	limit := 12
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if parsed, convErr := strconv.Atoi(raw); convErr == nil && parsed > 0 && parsed <= 30 {
			limit = parsed
		}
	}
	offset := 0
	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		if parsed, convErr := strconv.Atoi(raw); convErr == nil && parsed >= 0 && parsed <= 5000 {
			offset = parsed
		}
	}

	participantIDs := db.Model(&models.Prijava{}).Select("korisnik_id").Where("akcija_id = ?", akcija.ID)
	pendingTargetIDs := db.Model(&models.ActionParticipationRequest{}).
		Select("target_user_id").
		Where("akcija_id = ? AND status = ?", akcija.ID, models.ActionParticipationRequestPending)

	q := db.Model(&models.Korisnik{}).Preload("Klub").Where("role <> ?", "deleted").
		Where("id NOT IN (?)", participantIDs).
		Where("id NOT IN (?)", pendingTargetIDs)

	if akcija.KlubID != nil {
		if scope == "no-club" {
			q = q.Where("klub_id IS NULL")
		} else {
			q = q.Where("(klub_id IS NULL OR klub_id <> ?)", *akcija.KlubID)
		}
	} else if scope == "no-club" {
		q = q.Where("klub_id IS NULL")
	}

	if query != "" {
		like := "%" + strings.ToLower(query) + "%"
		q = q.Where("(LOWER(username) LIKE ? OR LOWER(full_name) LIKE ?)", like, like)
	}

	var users []models.Korisnik
	if err := q.Order("CASE WHEN full_name = '' THEN username ELSE full_name END ASC").Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri pretrazi korisnika"})
		return
	}

	out := make([]externalUserCandidateDTO, 0, len(users))
	for _, u := range users {
		if u.Role == "deleted" {
			continue
		}
		row := externalUserCandidateDTO{
			ID:        u.ID,
			Username:  u.Username,
			FullName:  u.FullName,
			AvatarURL: u.AvatarURL,
			KlubID:    u.KlubID,
		}
		if u.Klub != nil {
			row.KlubNaziv = u.Klub.Naziv
		}
		out = append(out, row)
	}

	c.JSON(http.StatusOK, gin.H{
		"users": out,
	})
}

func SearchEligibleClubMembers(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	actionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var akcija models.Akcija
	if err := db.Preload("Klub").First(&akcija, actionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da pretražuje članove"})
		return
	}
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Članovi se mogu dodavati tek kada je akcija završena"})
		return
	}
	if akcija.KlubID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija nema domaći klub"})
		return
	}

	query := strings.TrimSpace(c.Query("q"))
	limit := 5
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if parsed, convErr := strconv.Atoi(raw); convErr == nil && parsed > 0 && parsed <= 30 {
			limit = parsed
		}
	}
	offset := 0
	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		if parsed, convErr := strconv.Atoi(raw); convErr == nil && parsed >= 0 && parsed <= 5000 {
			offset = parsed
		}
	}

	alreadySummitedIDs := db.Model(&models.Prijava{}).
		Select("korisnik_id").
		Where("akcija_id = ? AND status = ?", akcija.ID, "popeo se")

	q := db.Model(&models.Korisnik{}).
		Preload("Klub").
		Where("role <> ?", "deleted").
		Where("klub_id = ?", *akcija.KlubID).
		Where("id NOT IN (?)", alreadySummitedIDs)

	if query != "" {
		like := "%" + strings.ToLower(query) + "%"
		q = q.Where("(LOWER(username) LIKE ? OR LOWER(full_name) LIKE ?)", like, like)
	}

	var users []models.Korisnik
	if err := q.Order("CASE WHEN full_name = '' THEN username ELSE full_name END ASC").Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri pretrazi članova"})
		return
	}

	out := make([]externalUserCandidateDTO, 0, len(users))
	for _, u := range users {
		if u.Role == "deleted" {
			continue
		}
		row := externalUserCandidateDTO{
			ID:        u.ID,
			Username:  u.Username,
			FullName:  u.FullName,
			AvatarURL: u.AvatarURL,
			KlubID:    u.KlubID,
		}
		if u.Klub != nil {
			row.KlubNaziv = u.Klub.Naziv
		}
		out = append(out, row)
	}

	c.JSON(http.StatusOK, gin.H{"users": out})
}

func ListActionParticipationRequests(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	actionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var akcija models.Akcija
	if err := db.First(&akcija, actionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo pristupa zahtevima za ovu akciju"})
		return
	}

	var requests []models.ActionParticipationRequest
	if err := db.
		Preload("Akcija").
		Preload("Akcija.Klub").
		Preload("TargetUser").
		Preload("TargetUser.Klub").
		Preload("RequestedBy").
		Preload("RequestedBy.Klub").
		Where("akcija_id = ?", akcija.ID).
		Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END ASC, created_at DESC").
		Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju zahteva"})
		return
	}

	out := make([]actionParticipationRequestDTO, 0, len(requests))
	for _, req := range requests {
		out = append(out, buildActionParticipationRequestDTO(req))
	}
	c.JSON(http.StatusOK, gin.H{"requests": out})
}

func CancelActionParticipationRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	currentUser, err := getCurrentKorisnik(c, db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	requestID, err := strconv.Atoi(c.Param("requestId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		var req models.ActionParticipationRequest
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Akcija").
			First(&req, requestID).Error; err != nil {
			return err
		}
		if req.RequestedByID != currentUser.ID {
			return errActionParticipationForbidden
		}
		if req.Status != models.ActionParticipationRequestPending {
			return errActionParticipationAlreadyHandled
		}
		now := time.Now()
		req.Status = models.ActionParticipationRequestCancelled
		req.RespondedAt = &now
		return tx.Save(&req).Error
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		case errors.Is(err, errActionParticipationForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da otkažete ovaj zahtev"})
		case errors.Is(err, errActionParticipationAlreadyHandled):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Samo pending zahtev može da se otkaže"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju zahteva"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Zahtev je otkazan"})
}

func CreateActionParticipationRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	actionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var payload struct {
		TargetUserID uint `json:"targetUserId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.TargetUserID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći targetUserId"})
		return
	}

	currentUser, err := getCurrentKorisnik(c, db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var reqDTO actionParticipationRequestDTO
	if err := db.Transaction(func(tx *gorm.DB) error {
		var akcija models.Akcija
		if err := tx.Preload("Klub").Clauses(clause.Locking{Strength: "UPDATE"}).First(&akcija, actionID).Error; err != nil {
			return err
		}
		if !helpers.CanManageAkcija(c, tx, akcija.KlubID) {
			return errActionParticipationForbidden
		}
		if !akcija.IsCompleted {
			return errActionParticipationNotCompleted
		}

		var target models.Korisnik
		if err := tx.Preload("Klub").First(&target, payload.TargetUserID).Error; err != nil {
			return err
		}
		if target.Role == "deleted" {
			return gorm.ErrRecordNotFound
		}
		if target.ID == currentUser.ID {
			return errActionParticipationSelfRequest
		}
		if akcija.KlubID != nil && target.KlubID != nil && *target.KlubID == *akcija.KlubID {
			return errActionParticipationSameClub
		}

		var existingPrijava models.Prijava
		if err := tx.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, target.ID).First(&existingPrijava).Error; err == nil {
			return errActionParticipationSameClub
		} else if err != nil && err != gorm.ErrRecordNotFound {
			return err
		}

		var existingPending models.ActionParticipationRequest
		if err := tx.Where("akcija_id = ? AND target_user_id = ? AND status = ?", akcija.ID, target.ID, models.ActionParticipationRequestPending).First(&existingPending).Error; err == nil {
			return errActionParticipationPendingExists
		} else if err != nil && err != gorm.ErrRecordNotFound {
			return err
		}

		req := models.ActionParticipationRequest{
			AkcijaID:      akcija.ID,
			TargetUserID:  target.ID,
			RequestedByID: currentUser.ID,
			Status:        models.ActionParticipationRequestPending,
		}
		if err := tx.Create(&req).Error; err != nil {
			return err
		}
		req.Akcija = akcija
		req.TargetUser = target
		req.RequestedBy = *currentUser
		reqDTO = buildActionParticipationRequestDTO(req)
		createActionParticipationRequestNotification(tx, req)
		return nil
	}); err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		case errors.Is(err, errActionParticipationSameClub):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Za domaći klub koristite postojeći unos člana na akciju ili korisnik već postoji na akciji"})
		case errors.Is(err, errActionParticipationPendingExists):
			c.JSON(http.StatusConflict, gin.H{"error": "Zahtev za ovog korisnika je već poslat i čeka potvrdu"})
		case errors.Is(err, errActionParticipationSelfRequest):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete slati zahtev sami sebi"})
		case errors.Is(err, errActionParticipationNotCompleted):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Zahtev se može slati samo za završenu akciju"})
		case errors.Is(err, errActionParticipationForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da šaljete zahteve za ovu akciju"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri slanju zahteva"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Zahtev je poslat",
		"request": reqDTO,
	})
}

func ListMyActionParticipationRequests(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	currentUser, err := getCurrentKorisnik(c, db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	status := strings.TrimSpace(strings.ToLower(c.DefaultQuery("status", models.ActionParticipationRequestPending)))
	validStatuses := map[string]bool{
		models.ActionParticipationRequestPending:   true,
		models.ActionParticipationRequestAccepted:  true,
		models.ActionParticipationRequestRejected:  true,
		models.ActionParticipationRequestCancelled: true,
		"all": true,
	}
	if !validStatuses[status] {
		status = models.ActionParticipationRequestPending
	}

	q := db.
		Preload("Akcija").
		Preload("Akcija.Klub").
		Preload("TargetUser").
		Preload("TargetUser.Klub").
		Preload("RequestedBy").
		Preload("RequestedBy.Klub").
		Where("target_user_id = ?", currentUser.ID)
	if status != "all" {
		q = q.Where("status = ?", status)
	}

	var requests []models.ActionParticipationRequest
	if err := q.Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END ASC, created_at DESC").Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju zahteva"})
		return
	}

	out := make([]actionParticipationRequestDTO, 0, len(requests))
	for _, req := range requests {
		out = append(out, buildActionParticipationRequestDTO(req))
	}
	c.JSON(http.StatusOK, gin.H{"requests": out})
}

func GetMyActionParticipationRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	currentUser, err := getCurrentKorisnik(c, db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	requestID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}
	req, err := loadActionParticipationRequestWithRelations(db, uint(requestID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		return
	}
	if req.TargetUserID != currentUser.ID && req.RequestedByID != currentUser.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pristup ovom zahtevu"})
		return
	}
	c.JSON(http.StatusOK, buildActionParticipationRequestDTO(*req))
}

func RespondToActionParticipationRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	currentUser, err := getCurrentKorisnik(c, db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	requestID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}

	var payload struct {
		Decision string `json:"decision" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}
	decision := strings.TrimSpace(strings.ToLower(payload.Decision))
	if decision != "accept" && decision != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Decision mora biti accept ili reject"})
		return
	}

	var responseDTO actionParticipationRequestDTO
	err = db.Transaction(func(tx *gorm.DB) error {
		var req models.ActionParticipationRequest
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Akcija").
			Preload("Akcija.Klub").
			Preload("TargetUser").
			Preload("TargetUser.Klub").
			Preload("RequestedBy").
			Preload("RequestedBy.Klub").
			First(&req, requestID).Error; err != nil {
			return err
		}
		if req.TargetUserID != currentUser.ID {
			return errActionParticipationForbidden
		}
		if req.Status != models.ActionParticipationRequestPending {
			return errActionParticipationAlreadyHandled
		}
		if !req.Akcija.IsCompleted {
			return errActionParticipationNotCompleted
		}

		now := time.Now()
		if decision == "reject" {
			req.Status = models.ActionParticipationRequestRejected
			req.RespondedAt = &now
			if err := tx.Save(&req).Error; err != nil {
				return err
			}
			responseDTO = buildActionParticipationRequestDTO(req)
			return nil
		}

		var prijava models.Prijava
		err := tx.Where("akcija_id = ? AND korisnik_id = ?", req.AkcijaID, req.TargetUserID).First(&prijava).Error
		alreadyPopeoSe := false
		if err == nil {
			alreadyPopeoSe = prijava.Status == "popeo se"
			prijava.Status = "popeo se"
			prijava.Platio = true
			if err := tx.Save(&prijava).Error; err != nil {
				return err
			}
		} else if err == gorm.ErrRecordNotFound {
			prijava = models.Prijava{
				AkcijaID:   req.AkcijaID,
				KorisnikID: req.TargetUserID,
				Status:     "popeo se",
				Platio:     true,
			}
			if err := tx.Create(&prijava).Error; err != nil {
				return err
			}
		} else {
			return err
		}

		if !alreadyPopeoSe {
			req.TargetUser.UkupnoKmKorisnik += req.Akcija.UkupnoKmAkcija
			req.TargetUser.UkupnoMetaraUsponaKorisnik += req.Akcija.UkupnoMetaraUsponaAkcija
			req.TargetUser.BrojPopeoSe += 1
			if err := tx.Save(&req.TargetUser).Error; err != nil {
				return err
			}
		}

		req.Status = models.ActionParticipationRequestAccepted
		req.RespondedAt = &now
		if err := tx.Save(&req).Error; err != nil {
			return err
		}
		responseDTO = buildActionParticipationRequestDTO(req)
		return nil
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		case errors.Is(err, errActionParticipationForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da odgovorite na ovaj zahtev"})
		case errors.Is(err, errActionParticipationAlreadyHandled):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ovaj zahtev je već obrađen"})
		case errors.Is(err, errActionParticipationNotCompleted):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija više nije u stanju za potvrdu učešća"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri obradi zahteva"})
		}
		return
	}

	message := "Zahtev je odbijen"
	if decision == "accept" {
		message = "Učešće je potvrđeno i akcija je dodata na vaš profil"
	}
	c.JSON(http.StatusOK, gin.H{
		"message": message,
		"request": responseDTO,
	})
}
