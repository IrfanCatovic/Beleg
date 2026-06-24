package handlers

import (
	"beleg-app/backend/internal/apperror"
	"beleg-app/backend/internal/services/guidebooking"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type createPeakGuideBookingBody struct {
	PeakID            uint   `json:"peakId"`
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

func CreatePeakGuideBooking(c *gin.Context) {
	db := DB(c)
	requester, err := AuthUserPtr(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Morate biti ulogovani."})
		return
	}

	var body createPeakGuideBookingBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravan zahtev."})
		return
	}
	if body.PeakID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vrh je obavezan."})
		return
	}
	desiredDate, timeOfDay, groupExp, equip, phone, errMsg := guidebooking.ValidateCreateBooking(guidebooking.CreateBookingInput{
		DesiredDate: body.DesiredDate, TimeOfDay: body.TimeOfDay, ExactTime: body.ExactTime,
		NumberOfPeople: body.NumberOfPeople, GroupExperience: body.GroupExperience,
		EquipmentStatus: body.EquipmentStatus, ContactPhone: body.ContactPhone,
	})
	if errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	result, svcErr := guidebooking.CreatePeak(db, guidebooking.CreatePeakInput{
		PeakID: body.PeakID, Requester: requester, DesiredDate: desiredDate,
		TimeOfDay: timeOfDay, ExactTime: body.ExactTime, DateFlexible: body.DateFlexible,
		NumberOfPeople: body.NumberOfPeople, GroupExperience: groupExp, EquipmentStatus: equip,
		ContactPhone: phone, AdditionalMessage: body.AdditionalMessage,
		SkipGuides: body.SkipGuides, GuideProfileIDs: body.GuideProfileIDs,
	})
	if svcErr != nil {
		apperror.Write(c, svcErr)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"bookingRequestId": result.Request.ID,
		"skipGuides":       body.SkipGuides,
		"notifiedCount":    result.NotifiedCount,
	})
}

func GetPeakGuideBooking(c *gin.Context) {
	db := DB(c)
	viewer, err := AuthUserPtr(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Morate biti ulogovani."})
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID."})
		return
	}

	result, svcErr := guidebooking.GetPeak(db, uint(id), viewer)
	if svcErr != nil {
		apperror.Write(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"booking": result.Booking})
}

func RejectPeakGuideBooking(c *gin.Context) {
	db := DB(c)
	viewer, err := AuthUserPtr(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Morate biti ulogovani."})
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID."})
		return
	}

	result, svcErr := guidebooking.RejectPeak(db, uint(id), viewer)
	if svcErr != nil {
		apperror.Write(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"booking": result.Booking, "message": "Zahtev je odbijen."})
}

type acceptPeakGuideBookingBody struct {
	ActionID uint `json:"actionId"`
}

func AcceptPeakGuideBooking(c *gin.Context) {
	db := DB(c)
	viewer, err := AuthUserPtr(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Morate biti ulogovani."})
		return
	}
	var body acceptPeakGuideBookingBody
	if err := c.ShouldBindJSON(&body); err != nil || body.ActionID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID akcije je obavezan."})
		return
	}
	bookingID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || bookingID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID."})
		return
	}

	result, conflict, acceptErr := guidebooking.AcceptPeak(db, uint(bookingID), viewer, body.ActionID)
	if writePeakAcceptError(c, acceptErr, conflict) {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"booking": result.Booking,
		"message": "Akcija je povezana sa zahtevom.",
	})
}
