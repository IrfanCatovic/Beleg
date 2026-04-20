package helpers

import (
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// IsNonEmptyEmailTaken vraća true ako neko drugi već koristi isti email (case-insensitive, trim).
// exceptUserID > 0 isključuje tog korisnika (npr. izmena profila).
func IsNonEmptyEmailTaken(db *gorm.DB, email string, exceptUserID uint) bool {
	n := strings.ToLower(strings.TrimSpace(email))
	if n == "" {
		return false
	}
	q := db.Model(&models.Korisnik{}).Where("LOWER(TRIM(email)) = ?", n)
	if exceptUserID != 0 {
		q = q.Where("id <> ?", exceptUserID)
	}
	var cnt int64
	if err := q.Count(&cnt).Error; err != nil {
		return false
	}
	return cnt > 0
}
