package helpers

import (
	"errors"
	"regexp"
	"strings"

	"gorm.io/gorm"
)

var usernameAllowedPattern = regexp.MustCompile(`^[a-z0-9._]+$`)

// NormalizeUsername skida razmake i pretvara u mala slova (jedinstveni oblik u bazi i za login).
func NormalizeUsername(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ValidateUsername normalizuje i proverava da li je username u bezbednom formatu.
func ValidateUsername(raw string) (string, error) {
	username := NormalizeUsername(raw)
	if username == "" {
		return "", errors.New("Korisničko ime je obavezno")
	}
	if len(username) < 2 || len(username) > 30 {
		return "", errors.New("Korisničko ime mora imati između 2 i 30 karaktera")
	}
	if !usernameAllowedPattern.MatchString(username) {
		return "", errors.New("Korisničko ime može sadržati samo mala slova, brojeve, tačku i donju crtu")
	}
	if strings.HasPrefix(username, ".") || strings.HasSuffix(username, ".") ||
		strings.HasPrefix(username, "_") || strings.HasSuffix(username, "_") {
		return "", errors.New("Korisničko ime ne sme počinjati ili završavati tačkom ili donjom crtom")
	}
	if strings.Contains(username, "..") || strings.Contains(username, "__") ||
		strings.Contains(username, "._") || strings.Contains(username, "_.") {
		return "", errors.New("Korisničko ime ne sme imati uzastopne specijalne znakove")
	}
	return username, nil
}

// DBWhereUsername filtrira po korisničkom imenu bez obzira na velika/mala slova (LOWER(username) = ...).
func DBWhereUsername(db *gorm.DB, username string) *gorm.DB {
	return db.Where("LOWER(username) = ?", NormalizeUsername(username))
}

// UsernameFromContext vrednost iz gin konteksta (nakon AuthMiddleware uvek normalizovano mala slova).
func UsernameFromContext(usernameVal any) string {
	s, _ := usernameVal.(string)
	return s
}
