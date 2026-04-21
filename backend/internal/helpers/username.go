package helpers

import (
	"errors"
	"regexp"
	"strings"
	"unicode"

	"gorm.io/gorm"
)

// Dozvoljeni znakovi pri unosu (velika/mala slova OK); u bazi i JWT uvek mala slova.
var usernameCharsetPattern = regexp.MustCompile(`^[a-zA-Z0-9._]+$`)

// NormalizeUsername skida razmake sa ivica i pretvara u mala slova (kanonski oblik u bazi i za login).
func NormalizeUsername(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ValidateUsername: prihvata unos sa velikim slovima, odbija razmake i nedozvoljene znakove; vraća uvek mala slova.
func ValidateUsername(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("Korisničko ime je obavezno")
	}
	for _, r := range trimmed {
		if unicode.IsSpace(r) {
			return "", errors.New("Korisničko ime ne sme sadržati razmake")
		}
	}
	if !usernameCharsetPattern.MatchString(trimmed) {
		return "", errors.New("Korisničko ime može sadržati samo slova, brojeve, tačku i donju crtu (bez razmaka, crtica i drugih znakova)")
	}
	username := strings.ToLower(trimmed)
	if len(username) < 2 || len(username) > 30 {
		return "", errors.New("Korisničko ime mora imati između 2 i 30 karaktera")
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

// UsernameFromContext vrednost iz gin konteksta (nakon AuthMiddleware uvek mala slova).
func UsernameFromContext(usernameVal any) string {
	s, _ := usernameVal.(string)
	return NormalizeUsername(s)
}
