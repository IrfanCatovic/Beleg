package helpers

import (
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// IsOpenRegistrationPendingConflict vraća true ako postoji neiskorišćen, neistekao pending
// sa istim username-om (case-insensitive) ili emailom (case-insensitive).
func IsOpenRegistrationPendingConflict(db *gorm.DB, usernameNorm, emailNorm string) bool {
	now := time.Now()
	var n int64
	_ = db.Model(&models.PendingOpenRegistration{}).
		Where("used_at IS NULL AND expires_at > ?", now).
		Where("(LOWER(username) = ? OR LOWER(email) = ?)", strings.ToLower(usernameNorm), strings.ToLower(emailNorm)).
		Count(&n).Error
	return n > 0
}
