package handlers

import (
	"errors"
	"net/http"

	"beleg-app/backend/internal/services/guidebooking"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func writeFerrataAcceptError(c *gin.Context, err error, conflict *guidebooking.AcceptConflict) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, guidebooking.ErrAlreadyFulfilled) {
		payload := gin.H{"error": "Zahtev je već rešen — drugi vodič je kreirao akciju."}
		if conflict != nil {
			if conflict.FulfilledActionID != nil {
				payload["fulfilledActionId"] = *conflict.FulfilledActionID
			}
			if conflict.FulfilledByGuideName != "" {
				payload["fulfilledByGuideName"] = conflict.FulfilledByGuideName
			}
		}
		c.JSON(http.StatusConflict, payload)
		return true
	}
	if errors.Is(err, guidebooking.ErrNotGuideTarget) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Niste vodič za ovaj zahtev."})
		return true
	}
	if errors.Is(err, guidebooking.ErrActionNotFound) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija nije pronađena."})
		return true
	}
	if errors.Is(err, guidebooking.ErrInvalidAction) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija mora biti via ferrata na istoj ferati kao zahtev."})
		return true
	}
	if errors.Is(err, guidebooking.ErrActionNotOwned) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akciju može povezati samo vodič koji je kreirao akciju."})
		return true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen."})
		return true
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Povezivanje akcije nije uspelo."})
	return true
}

func writePeakAcceptError(c *gin.Context, err error, conflict *guidebooking.AcceptConflict) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, guidebooking.ErrAlreadyFulfilled) {
		payload := gin.H{"error": "Zahtev je već rešen — drugi vodič je kreirao akciju."}
		if conflict != nil {
			if conflict.FulfilledActionID != nil {
				payload["fulfilledActionId"] = *conflict.FulfilledActionID
			}
			if conflict.FulfilledByGuideName != "" {
				payload["fulfilledByGuideName"] = conflict.FulfilledByGuideName
			}
		}
		c.JSON(http.StatusConflict, payload)
		return true
	}
	if errors.Is(err, guidebooking.ErrNotGuideTarget) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Niste vodič za ovaj zahtev."})
		return true
	}
	if errors.Is(err, guidebooking.ErrActionNotFound) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija nije pronađena."})
		return true
	}
	if errors.Is(err, guidebooking.ErrInvalidAction) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija mora biti planinarska na istom vrhu kao zahtev."})
		return true
	}
	if errors.Is(err, guidebooking.ErrActionNotOwned) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akciju može povezati samo vodič koji je kreirao akciju."})
		return true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen."})
		return true
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Povezivanje akcije nije uspelo."})
	return true
}
