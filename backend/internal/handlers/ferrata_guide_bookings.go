package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createFerrataGuideBookingBody struct {
	FerrataID         uint   `json:"ferrataId"`
	GuideProfileIDs   []uint `json:"guideProfileIds"`
	SkipGuides        bool   `json:"skipGuides"`
	DesiredDate       string `json:"desiredDate"`
	TimeOfDay         string `json:"timeOfDay"`
	ExactTime         string `json:"exactTime"`
	DateFlexible      bool   `json:"dateFlexible"`
	NumberOfPeople    int    `json:"numberOfPeople"`
	GroupExperience   string `json:"groupExperience"`
	EquipmentStatus   string `json:"equipmentStatus"`
	ContactPhone      string `json:"contactPhone"`
	AdditionalMessage string `json:"additionalMessage"`
}

var (
	allowedBookingTimeOfDay = map[string]bool{
		"morning": true, "afternoon": true, "any": true, "exact": true,
	}
	allowedBookingExperience = map[string]bool{
		"beginners": true, "recreational": true, "experienced": true, "mixed": true,
	}
	allowedBookingEquipment = map[string]bool{
		"complete": true, "none": true, "partial": true, "unsure": true,
	}
)

func CreateFerrataGuideBooking(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	requester, err := getCurrentKorisnik(c, db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Morate biti ulogovani."})
		return
	}

	var body createFerrataGuideBookingBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan zahtev."})
		return
	}
	if body.FerrataID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ferata je obavezna."})
		return
	}
	desiredDate, err := time.Parse("2006-01-02", strings.TrimSpace(body.DesiredDate))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan datum."})
		return
	}
	timeOfDay := strings.TrimSpace(body.TimeOfDay)
	if !allowedBookingTimeOfDay[timeOfDay] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravno vreme / deo dana."})
		return
	}
	if timeOfDay == "exact" && strings.TrimSpace(body.ExactTime) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite tačno vreme."})
		return
	}
	if body.NumberOfPeople < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Broj osoba mora biti najmanje 1."})
		return
	}
	groupExp := strings.TrimSpace(body.GroupExperience)
	if !allowedBookingExperience[groupExp] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite iskustvo grupe."})
		return
	}
	equip := strings.TrimSpace(body.EquipmentStatus)
	if !allowedBookingEquipment[equip] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite status opreme."})
		return
	}
	phone := strings.TrimSpace(body.ContactPhone)
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kontakt telefon je obavezan."})
		return
	}

	var ferrata models.Ferrata
	if err := db.First(&ferrata, body.FerrataID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ferata nije pronađena."})
		return
	}

	skipGuides := body.SkipGuides
	guideIDs := uniqueUints(body.GuideProfileIDs)
	if !skipGuides {
		if len(guideIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite bar jednog vodiča ili označite da vam vodič nije potreban."})
			return
		}
	}

	var targets []models.FerrataGuideBookingTarget
	if !skipGuides {
		var profiles []models.GuideProfile
		if err := db.Where("id IN ? AND status = ?", guideIDs, models.GuideStatusApproved).Find(&profiles).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri vodiča."})
			return
		}
		if len(profiles) != len(guideIDs) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jedan ili više vodiča nije dostupan."})
			return
		}
		for _, p := range profiles {
			targets = append(targets, models.FerrataGuideBookingTarget{
				GuideProfileID: p.ID,
				GuideUserID:    p.KorisnikID,
			})
		}
	}

	req := models.FerrataGuideBookingRequest{
		FerrataID:         ferrata.ID,
		RequesterID:       requester.ID,
		DesiredDate:       desiredDate,
		TimeOfDay:         timeOfDay,
		ExactTime:         strings.TrimSpace(body.ExactTime),
		DateFlexible:      body.DateFlexible,
		NumberOfPeople:    body.NumberOfPeople,
		GroupExperience:   groupExp,
		EquipmentStatus:   equip,
		ContactPhone:      phone,
		AdditionalMessage: strings.TrimSpace(body.AdditionalMessage),
		SkipGuides:        skipGuides,
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&req).Error; err != nil {
			return err
		}
		for i := range targets {
			targets[i].BookingRequestID = req.ID
		}
		if len(targets) > 0 {
			if err := tx.Create(&targets).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Čuvanje zahteva nije uspelo."})
		return
	}

	if len(targets) > 0 {
		req.Requester = requester
		req.Ferrata = &ferrata
		notifyGuideBookingTargets(db, req, targets)
	}

	c.JSON(http.StatusCreated, gin.H{
		"bookingRequestId": req.ID,
		"skipGuides":       skipGuides,
		"notifiedCount":    len(targets),
	})
}

func notifyGuideBookingTargets(db *gorm.DB, req models.FerrataGuideBookingRequest, targets []models.FerrataGuideBookingTarget) {
	requesterName := strings.TrimSpace(req.Requester.FullName)
	if requesterName == "" {
		requesterName = strings.TrimSpace(req.Requester.Username)
	}
	if requesterName == "" {
		requesterName = "Korisnik"
	}
	ferrataName := strings.TrimSpace(req.Ferrata.Naziv)
	if ferrataName == "" {
		ferrataName = "feratu"
	}
	dateStr := req.DesiredDate.Format("02.01.2006")
	title := "Imate novi zahtev za akciju"
	body := requesterName + " traži vođenje na ferati \"" + ferrataName + "\" za datum " + dateStr + "."

	metaBase := map[string]any{
		"bookingRequestId": req.ID,
		"ferrataId":        req.FerrataID,
		"ferrataNaziv":     ferrataName,
		"requesterId":      req.RequesterID,
		"requesterUsername": req.Requester.Username,
		"requesterFullName": req.Requester.FullName,
		"desiredDate":      req.DesiredDate.Format("2006-01-02"),
		"numberOfPeople":   req.NumberOfPeople,
	}

	seen := map[uint]bool{}
	for _, t := range targets {
		if t.GuideUserID == 0 || seen[t.GuideUserID] {
			continue
		}
		seen[t.GuideUserID] = true
		meta := metaBase
		meta["guideProfileId"] = t.GuideProfileID
		metaBytes, _ := json.Marshal(meta)
		notifications.NotifyUsers(
			db,
			[]uint{t.GuideUserID},
			models.ObavestenjeTipGuideBookingRequest,
			title,
			body,
			"",
			string(metaBytes),
		)
	}
}

func GetFerrataGuideBooking(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	viewer, err := getCurrentKorisnik(c, db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Morate biti ulogovani."})
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID."})
		return
	}

	var req models.FerrataGuideBookingRequest
	if err := db.
		Preload("Ferrata").
		Preload("Requester").
		Preload("Requester.Klub").
		Preload("Targets").
		Preload("Targets.GuideProfile").
		Preload("Targets.GuideProfile.Korisnik").
		First(&req, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen."})
		return
	}

	allowed := req.RequesterID == viewer.ID
	if !allowed {
		for _, t := range req.Targets {
			if t.GuideUserID == viewer.ID {
				allowed = true
				break
			}
		}
	}
	if !allowed && viewer.Role == "superadmin" {
		allowed = true
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pristup ovom zahtevu."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"booking": buildFerrataGuideBookingDTO(db, req)})
}

func buildFerrataGuideBookingDTO(db *gorm.DB, req models.FerrataGuideBookingRequest) gin.H {
	ferrataPayload := gin.H{
		"id":    req.FerrataID,
		"naziv": "",
		"slug":  "",
	}
	if req.Ferrata != nil {
		ferrataPayload["naziv"] = req.Ferrata.Naziv
		ferrataPayload["slug"] = req.Ferrata.Slug
		ferrataPayload["gradOpstina"] = req.Ferrata.GradOpstina
		ferrataPayload["drzava"] = req.Ferrata.Drzava
		ferrataPayload["lokacija"] = req.Ferrata.Lokacija
	}

	requesterPayload := gin.H{"id": req.RequesterID}
	if req.Requester != nil {
		requesterPayload["username"] = req.Requester.Username
		requesterPayload["fullName"] = req.Requester.FullName
		requesterPayload["avatarUrl"] = req.Requester.AvatarURL
		requesterPayload["telefon"] = req.Requester.Telefon
		requesterPayload["isProfiGuide"] = helpers.KorisnikIsApprovedProfiGuide(db, req.Requester.ID)
		if req.Requester.Klub != nil {
			requesterPayload["klubNaziv"] = req.Requester.Klub.Naziv
		}
	}

	return gin.H{
		"id":                req.ID,
		"ferrataId":         req.FerrataID,
		"desiredDate":       req.DesiredDate.Format("2006-01-02"),
		"timeOfDay":         req.TimeOfDay,
		"exactTime":         req.ExactTime,
		"dateFlexible":      req.DateFlexible,
		"numberOfPeople":    req.NumberOfPeople,
		"groupExperience":   req.GroupExperience,
		"equipmentStatus":   req.EquipmentStatus,
		"contactPhone":      req.ContactPhone,
		"additionalMessage": req.AdditionalMessage,
		"skipGuides":        req.SkipGuides,
		"createdAt":         req.CreatedAt,
		"ferrata":           ferrataPayload,
		"requester":         requesterPayload,
	}
}

func uniqueUints(in []uint) []uint {
	seen := map[uint]bool{}
	var out []uint
	for _, id := range in {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}
