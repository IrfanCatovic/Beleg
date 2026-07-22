package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type actionSignupRequestDTO struct {
	ID                 uint              `json:"id"`
	Status             string            `json:"status"`
	CreatedAt          time.Time         `json:"createdAt"`
	RespondedAt        *time.Time        `json:"respondedAt,omitempty"`
	SelectedSmestajIDs []uint            `json:"selectedSmestajIds"`
	SelectedPrevozIDs  []uint            `json:"selectedPrevozIds"`
	SelectedRentItems  []prijavaRentItem `json:"selectedRentItems"`
	Requester          gin.H             `json:"requester"`
	Action             gin.H             `json:"action,omitempty"`
}

func parseSignupChoices(req *models.ActionSignupRequest) ([]uint, []uint, []prijavaRentItem) {
	smestaj := []uint{}
	prevoz := []uint{}
	rent := []prijavaRentItem{}
	if req != nil {
		_ = json.Unmarshal([]byte(req.SelectedSmestajIDs), &smestaj)
		_ = json.Unmarshal([]byte(req.SelectedPrevozIDs), &prevoz)
		_ = json.Unmarshal([]byte(req.SelectedRentItemsRaw), &rent)
	}
	return smestaj, prevoz, rent
}

func buildActionSignupRequestDTO(db *gorm.DB, req models.ActionSignupRequest, includeAction bool) actionSignupRequestDTO {
	smestaj, prevoz, rent := parseSignupChoices(&req)
	requesterName := strings.TrimSpace(req.Requester.FullName)
	if requesterName == "" {
		requesterName = strings.TrimSpace(req.Requester.Username)
	}
	dto := actionSignupRequestDTO{
		ID:                 req.ID,
		Status:             req.Status,
		CreatedAt:          req.CreatedAt,
		RespondedAt:        req.RespondedAt,
		SelectedSmestajIDs: smestaj,
		SelectedPrevozIDs:  prevoz,
		SelectedRentItems:  rent,
		Requester: gin.H{
			"id":           req.Requester.ID,
			"username":     req.Requester.Username,
			"fullName":     req.Requester.FullName,
			"avatarUrl":    req.Requester.AvatarURL,
			"isProfiGuide": helpers.KorisnikIsApprovedProfiGuide(db, req.Requester.ID),
		},
	}
	if includeAction && req.Akcija.ID > 0 {
		dto.Action = gin.H{
			"id":      req.Akcija.ID,
			"naziv":   req.Akcija.Naziv,
			"datum":   req.Akcija.Datum,
			"planina": req.Akcija.Planina,
			"vrh":     req.Akcija.Vrh,
		}
	}
	_ = requesterName
	return dto
}

func resolveSignupApprovers(db *gorm.DB, akcija *models.Akcija) []uint {
	if akcija == nil {
		return nil
	}
	if akcija.VodicID > 0 {
		return []uint{akcija.VodicID}
	}
	if akcija.KlubID == nil || *akcija.KlubID == 0 {
		return nil
	}
	var ids []uint
	_ = db.Model(&models.Korisnik{}).
		Where("klub_id = ? AND role IN ?", *akcija.KlubID, []string{"admin", "sekretar"}).
		Pluck("id", &ids).Error
	return ids
}

func canApproveSignupRequest(c *gin.Context, db *gorm.DB, akcija *models.Akcija) bool {
	if akcija == nil {
		return false
	}
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role == "superadmin" {
		return true
	}
	usernameVal, exists := c.Get("username")
	if !exists {
		return false
	}
	var viewer models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(usernameVal)).First(&viewer).Error; err != nil {
		return false
	}
	if akcija.VodicID > 0 || akcija.AddedByID > 0 {
		return helpers.IsAkcijaLeader(akcija, viewer.ID)
	}
	if akcija.KlubID != nil && viewer.KlubID != nil && *viewer.KlubID == *akcija.KlubID {
		return role == "admin" || role == "sekretar"
	}
	return false
}

func createSignupRequestNotification(db *gorm.DB, req models.ActionSignupRequest) {
	requesterName := strings.TrimSpace(req.Requester.FullName)
	if requesterName == "" {
		requesterName = strings.TrimSpace(req.Requester.Username)
	}
	if requesterName == "" {
		requesterName = "Korisnik"
	}
	actionName := strings.TrimSpace(req.Akcija.Naziv)
	if actionName == "" {
		actionName = "akciju"
	}
	title := "Novi zahtev za prijavu na akciju"
	body := requesterName + " želi da se prijavi na akciju \"" + actionName + "\". Pregledajte zahtev i odobrite ili odbijte prijavu."
	metaMap := map[string]any{
		"requestId":         req.ID,
		"akcijaId":          req.Akcija.ID,
		"akcijaNaziv":       req.Akcija.Naziv,
		"requesterId":       req.Requester.ID,
		"requesterUsername": req.Requester.Username,
		"requesterFullName": req.Requester.FullName,
	}
	metaBytes, _ := json.Marshal(metaMap)
	link := fmt.Sprintf("/akcije/%d", req.Akcija.ID)
	approvers := resolveSignupApprovers(db, &req.Akcija)
	if len(approvers) == 0 {
		return
	}
	notifications.NotifyUsers(
		db,
		approvers,
		models.ObavestenjeTipActionSignupRequest,
		title,
		body,
		link,
		string(metaBytes),
	)
}

func notifySignupRequestResponded(db *gorm.DB, req models.ActionSignupRequest, accepted bool) {
	actionName := strings.TrimSpace(req.Akcija.Naziv)
	if actionName == "" {
		actionName = "akciju"
	}
	var title, body string
	if accepted {
		title = "Prijava na akciju odobrena"
		body = "Vaš zahtev za prijavu na akciju \"" + actionName + "\" je prihvaćen. Sada ste na spisku prijavljenih."
	} else {
		title = "Prijava na akciju odbijena"
		body = "Vaš zahtev za prijavu na akciju \"" + actionName + "\" je odbijen."
	}
	metaMap := map[string]any{
		"requestId": req.ID,
		"akcijaId":  req.Akcija.ID,
		"accepted":  accepted,
	}
	metaBytes, _ := json.Marshal(metaMap)
	link := fmt.Sprintf("/akcije/%d", req.Akcija.ID)
	notifications.NotifyUsers(
		db,
		[]uint{req.RequesterID},
		models.ObavestenjeTipActionSignupRequest,
		title,
		body,
		link,
		string(metaBytes),
	)
}

func loadActionSignupRequestWithRelations(db *gorm.DB, requestID uint) (*models.ActionSignupRequest, error) {
	var req models.ActionSignupRequest
	if err := db.
		Preload("Akcija").
		Preload("Requester").
		First(&req, requestID).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

func validateSignupAccess(db *gorm.DB, akcija *models.Akcija, korisnik *models.Korisnik, inviteToken string) error {
	if err := helpers.ValidateAkcijaSignupOpen(akcija, time.Now()); err != nil {
		return err
	}
	if !akcija.Javna {
		isClubMember := akcija.KlubID != nil && korisnik.KlubID != nil && *akcija.KlubID == *korisnik.KlubID
		if !isClubMember {
			if !hasValidActionInviteLink(db, akcija.ID, inviteToken) {
				return errors.New("Za klupsku akciju morate biti član kluba ili imati važeći invite link.")
			}
		}
	}
	if akcija.RokPrijava != nil {
		now := time.Now()
		deadline := time.Date(akcija.RokPrijava.Year(), akcija.RokPrijava.Month(), akcija.RokPrijava.Day(), 23, 59, 59, 0, akcija.RokPrijava.Location())
		if now.After(deadline) {
			return errors.New("Rok za prijavu je istekao")
		}
	}
	return nil
}

func createPrijavaFromChoices(tx *gorm.DB, akcijaID uint, korisnik models.Korisnik, choices prijavaChoicesPayload) (models.Prijava, error) {
	locked, err := helpers.LockAkcijaForUpdate(tx, akcijaID)
	if err != nil {
		return models.Prijava{}, err
	}
	return createPrijavaFromChoicesWithLockedAkcija(tx, locked, korisnik, choices)
}

// createPrijavaFromChoicesWithLockedAkcija koristi već zaključanu akciju (Akcija → … redoslijed).
// Ne zaključava ponovo akciju i ne otvara novu transakciju.
func createPrijavaFromChoicesWithLockedAkcija(tx *gorm.DB, locked *models.Akcija, korisnik models.Korisnik, choices prijavaChoicesPayload) (models.Prijava, error) {
	if locked == nil {
		return models.Prijava{}, gorm.ErrRecordNotFound
	}
	akcijaID := locked.ID

	if err := helpers.ValidateAkcijaSignupOpen(locked, time.Now()); err != nil {
		return models.Prijava{}, err
	}

	if err := validatePrijavaChoicesTx(tx, akcijaID, &choices, nil); err != nil {
		return models.Prijava{}, err
	}

	if err := helpers.EnsureCapacityAvailable(tx, akcijaID, locked.MaxLjudi); err != nil {
		return models.Prijava{}, err
	}

	smestajJSON, _ := json.Marshal(choices.SelectedSmestajIDs)
	prevozJSON, _ := json.Marshal(choices.SelectedPrevozIDs)
	rentJSON, _ := json.Marshal(choices.SelectedRentItems)
	izboriPayload := helpers.PrijavaIzboriPayload{
		SelectedSmestajIDs:   string(smestajJSON),
		SelectedPrevozIDs:    string(prevozJSON),
		SelectedRentItemsRaw: string(rentJSON),
	}

	var existing models.Prijava
	err := tx.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).First(&existing).Error
	if err == nil {
		if existing.Status == "otkazano" {
			return helpers.ReactivateCancelledPrijavaFromChoicesTx(tx, existing.ID, izboriPayload)
		}
		return models.Prijava{}, helpers.ErrDuplicatePrijava
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Prijava{}, err
	}

	prijava := models.Prijava{
		AkcijaID:   akcijaID,
		KorisnikID: korisnik.ID,
	}
	if err := tx.Create(&prijava).Error; err != nil {
		if mapped := helpers.MapCreatePrijavaError(err); errors.Is(mapped, helpers.ErrDuplicatePrijava) {
			var raceExisting models.Prijava
			if fetchErr := tx.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).First(&raceExisting).Error; fetchErr == nil {
				if raceExisting.Status == "otkazano" {
					return helpers.ReactivateCancelledPrijavaFromChoicesTx(tx, raceExisting.ID, izboriPayload)
				}
				return models.Prijava{}, helpers.ErrDuplicatePrijava
			}
		}
		return models.Prijava{}, helpers.MapCreatePrijavaError(err)
	}
	izbor := models.PrijavaIzbori{
		PrijavaID:            prijava.ID,
		SelectedSmestajIDs:   izboriPayload.SelectedSmestajIDs,
		SelectedPrevozIDs:    izboriPayload.SelectedPrevozIDs,
		SelectedRentItemsRaw: izboriPayload.SelectedRentItemsRaw,
	}
	if err := tx.Create(&izbor).Error; err != nil {
		return models.Prijava{}, err
	}
	return prijava, nil
}

func computeSaldoForChoices(db *gorm.DB, akcija models.Akcija, korisnik models.Korisnik, choices prijavaChoicesPayload) float64 {
	return helpers.ComputeSaldoForParticipant(db, akcija, korisnik, choicesPayloadToHelpers(choices))
}

func parseChoicesFromRequest(c *gin.Context) prijavaChoicesPayload {
	choices := prijavaChoicesPayload{}
	if strings.Contains(c.GetHeader("Content-Type"), "application/json") {
		_ = c.ShouldBindJSON(&choices)
	} else {
		if raw := strings.TrimSpace(c.PostForm("selectedSmestajIds")); raw != "" {
			_ = json.Unmarshal([]byte(raw), &choices.SelectedSmestajIDs)
		}
		if raw := strings.TrimSpace(c.PostForm("selectedPrevozIds")); raw != "" {
			_ = json.Unmarshal([]byte(raw), &choices.SelectedPrevozIDs)
		}
		if raw := strings.TrimSpace(c.PostForm("selectedRentItems")); raw != "" {
			_ = json.Unmarshal([]byte(raw), &choices.SelectedRentItems)
		}
	}
	choices.SelectedRentItems = normalizeRentItems(choices.SelectedRentItems)
	return choices
}

func GetActionSignupRequests(c *gin.Context) {
	db := DB(c)
	akcijaID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !canApproveSignupRequest(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate dozvolu da pregledate zahteve za prijavu"})
		return
	}
	statusFilter := strings.TrimSpace(c.DefaultQuery("status", "pending"))
	var reqs []models.ActionSignupRequest
	q := db.Preload("Requester").Where("akcija_id = ?", akcijaID)
	if statusFilter != "all" {
		q = q.Where("status = ?", statusFilter)
	}
	if err := q.Order("created_at ASC").Find(&reqs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju zahteva"})
		return
	}
	out := make([]actionSignupRequestDTO, 0, len(reqs))
	for _, req := range reqs {
		out = append(out, buildActionSignupRequestDTO(db, req, false))
	}
	c.JSON(http.StatusOK, gin.H{"requests": out})
}

func GetActionSignupRequestByID(c *gin.Context) {
	db := DB(c)
	requestID, err := strconv.Atoi(c.Param("requestId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}
	req, err := loadActionSignupRequestWithRelations(db, uint(requestID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		return
	}
	usernameVal, _ := c.Get("username")
	var viewer models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(usernameVal)).First(&viewer).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	isRequester := viewer.ID == req.RequesterID
	isApprover := canApproveSignupRequest(c, db, &req.Akcija)
	if !isRequester && !isApprover {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pristup ovom zahtevu"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"request": buildActionSignupRequestDTO(db, *req, true)})
}

var errSignupRequestAlreadyProcessed = errors.New("Zahtev je već obrađen")
var errSignupRespondForbidden = errors.New("signup respond forbidden")

func RespondToActionSignupRequest(c *gin.Context) {
	db := DB(c)
	akcijaID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	requestID, err := strconv.Atoi(c.Param("requestId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}
	var body struct {
		Action string `json:"action"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}
	action := strings.TrimSpace(strings.ToLower(body.Action))
	if action != "accept" && action != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "action mora biti accept ili reject"})
		return
	}
	usernameVal, _ := c.Get("username")
	var reviewer models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(usernameVal)).First(&reviewer).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	// Preliminary read: samo akcija_id radi prvog action locka — nije autoritativan.
	var lookup struct {
		AkcijaID uint
	}
	if err := db.Model(&models.ActionSignupRequest{}).
		Select("akcija_id").
		Where("id = ?", requestID).
		Take(&lookup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju zahteva"})
		return
	}
	if lookup.AkcijaID == 0 || lookup.AkcijaID != uint(akcijaID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		return
	}

	// Rani authorization (optimization); konačna odluka je nakon lockova.
	var earlyAkcija models.Akcija
	if err := db.First(&earlyAkcija, lookup.AkcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !canApproveSignupRequest(c, db, &earlyAkcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate dozvolu da odgovorite na zahtev"})
		return
	}

	var respondedReq *models.ActionSignupRequest
	err = db.Transaction(func(tx *gorm.DB) error {
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, lookup.AkcijaID)
		if err != nil {
			return err
		}
		req, err := helpers.LockActionSignupRequestForUpdate(tx, uint(requestID))
		if err != nil {
			return err
		}
		if req.AkcijaID != lockedAkcija.ID || req.AkcijaID != uint(akcijaID) {
			return gorm.ErrRecordNotFound
		}
		if req.Status != models.ActionSignupRequestPending {
			return errSignupRequestAlreadyProcessed
		}
		if !canApproveSignupRequest(c, tx, lockedAkcija) {
			return errSignupRespondForbidden
		}

		now := time.Now()
		reviewerID := reviewer.ID
		if action == "reject" {
			req.Status = models.ActionSignupRequestRejected
			req.ReviewedByID = &reviewerID
			req.RespondedAt = &now
			if err := tx.Save(req).Error; err != nil {
				return err
			}
			req.Akcija = *lockedAkcija
			respondedReq = req
			return nil
		}

		smestaj, prevoz, rent := parseSignupChoices(req)
		choices := prijavaChoicesPayload{
			SelectedSmestajIDs: smestaj,
			SelectedPrevozIDs:  prevoz,
			SelectedRentItems:  rent,
		}
		var requester models.Korisnik
		if err := tx.First(&requester, req.RequesterID).Error; err != nil {
			return err
		}
		if _, err := createPrijavaFromChoicesWithLockedAkcija(tx, lockedAkcija, requester, choices); err != nil {
			return err
		}
		req.Status = models.ActionSignupRequestAccepted
		req.ReviewedByID = &reviewerID
		req.RespondedAt = &now
		if err := tx.Save(req).Error; err != nil {
			return err
		}
		req.Akcija = *lockedAkcija
		respondedReq = req
		return nil
	})
	if err != nil {
		errMsg := err.Error()
		if errors.Is(err, helpers.ErrAkcijaCapacityFull) ||
			strings.Contains(errMsg, "popunjen") ||
			strings.Contains(errMsg, "popunjena") ||
			strings.Contains(errMsg, "Nedovoljno") {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}
		if errors.Is(err, helpers.ErrDuplicatePrijava) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrSignupClosed) || errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, helpers.ErrAkcijaCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, errSignupRequestAlreadyProcessed) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, errSignupRespondForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Nemate dozvolu da odgovorite na zahtev"})
			return
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri obradi zahteva", "details": errMsg})
		return
	}
	// Notifikacije tek nakon uspješnog commita (accepted i rejected).
	if respondedReq != nil {
		notifySignupRequestResponded(db, *respondedReq, action == "accept")
	}
	msg := "Zahtev je odbijen"
	if action == "accept" {
		msg = "Prijava je odobrena"
	}
	c.JSON(http.StatusOK, gin.H{"message": msg})
}

// errCancelSignupNotActive: nema aktivnog pending zahteva (postojeća API semantika, nije idempotentno).
var errCancelSignupNotActive = errors.New("Nemate aktivan zahtev za prijavu na ovu akciju")

func CancelMojActionSignupRequest(c *gin.Context) {
	db := DB(c)
	akcijaID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(usernameVal)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	// Preliminary read: id + akcija_id radi lock ordera — nije autoritativan.
	var lookup struct {
		ID       uint
		AkcijaID uint
	}
	if err := db.Model(&models.ActionSignupRequest{}).
		Select("id", "akcija_id").
		Where("akcija_id = ? AND requester_id = ? AND status = ?", akcijaID, korisnik.ID, models.ActionSignupRequestPending).
		Take(&lookup).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": errCancelSignupNotActive.Error()})
		return
	}
	if lookup.ID == 0 || lookup.AkcijaID != uint(akcijaID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": errCancelSignupNotActive.Error()})
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, lookup.AkcijaID)
		if err != nil {
			return err
		}
		req, err := helpers.LockActionSignupRequestForUpdate(tx, lookup.ID)
		if err != nil {
			return err
		}
		if req.AkcijaID != lockedAkcija.ID || req.AkcijaID != uint(akcijaID) {
			return errCancelSignupNotActive
		}
		if req.RequesterID != korisnik.ID {
			return errCancelSignupNotActive
		}
		if req.Status != models.ActionSignupRequestPending {
			return errCancelSignupNotActive
		}

		now := time.Now()
		req.Status = models.ActionSignupRequestCancelled
		req.RespondedAt = &now
		// ReviewedByID ostaje kako je bilo (za pending tipično nil); ne postavlja se reviewer.
		return tx.Save(req).Error
	})
	if err != nil {
		if errors.Is(err, errCancelSignupNotActive) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akcija ili zahtev nije pronađen"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju zahteva"})
		return
	}
	// Cancel ne šalje notifikaciju (postojeća semantika).
	c.JSON(http.StatusOK, gin.H{"message": "Zahtev za prijavu je otkazan"})
}

func GetMojiActionSignupRequests(c *gin.Context) {
	db := DB(c)
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(usernameVal)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	statusFilter := strings.TrimSpace(c.DefaultQuery("status", "pending"))
	var reqs []models.ActionSignupRequest
	q := db.Preload("Akcija").Where("requester_id = ?", korisnik.ID)
	if statusFilter != "all" {
		q = q.Where("status = ?", statusFilter)
	}
	if err := q.Order("created_at DESC").Find(&reqs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju zahteva"})
		return
	}
	out := make([]actionSignupRequestDTO, 0, len(reqs))
	for _, req := range reqs {
		out = append(out, buildActionSignupRequestDTO(db, req, true))
	}
	c.JSON(http.StatusOK, gin.H{"requests": out})
}
