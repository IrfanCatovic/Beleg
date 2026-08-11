package socialauth

import (
	"strconv"
	"strings"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

var latinReplacer = strings.NewReplacer(
	"č", "c", "ć", "c", "š", "s", "ž", "z", "đ", "dj",
	"Č", "c", "Ć", "c", "Š", "s", "Ž", "z", "Đ", "dj",
)

// SuggestUsername predlaže slobodan username; nije rezervacija.
func SuggestUsername(db *gorm.DB, fullName, email string) string {
	base := usernameSeed(fullName, email)
	if availableUsername(db, base) {
		return base
	}
	for n := 2; n <= 9999; n++ {
		suffix := strconv.Itoa(n)
		trimmed := base
		maxBase := 30 - len(suffix)
		if maxBase < 2 {
			break
		}
		if len(trimmed) > maxBase {
			trimmed = trimmed[:maxBase]
		}
		candidate := trimmed + suffix
		if _, err := helpers.ValidateUsername(candidate); err != nil {
			continue
		}
		if availableUsername(db, candidate) {
			return candidate
		}
	}
	return base
}

func usernameSeed(fullName, email string) string {
	fromName := sanitizeUsernameSource(latinReplacer.Replace(fullName))
	if cand, err := helpers.ValidateUsername(fromName); err == nil {
		return cand
	}
	local := email
	if i := strings.Index(email, "@"); i > 0 {
		local = email[:i]
	}
	fromEmail := sanitizeUsernameSource(latinReplacer.Replace(local))
	if cand, err := helpers.ValidateUsername(fromEmail); err == nil {
		return cand
	}
	return "user"
}

func sanitizeUsernameSource(raw string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(raw)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if len(s) > 30 {
		s = s[:30]
	}
	return s
}

func availableUsername(db *gorm.DB, username string) bool {
	if db == nil {
		return true
	}
	var n int64
	if err := helpers.DBWhereUsername(db.Model(&models.Korisnik{}), username).Count(&n).Error; err != nil {
		return false
	}
	return n == 0
}
