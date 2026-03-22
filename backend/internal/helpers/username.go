package helpers

import (
	"strings"

	"gorm.io/gorm"
)

// NormalizeUsername skida razmake i pretvara u mala slova (jedinstveni oblik u bazi i za login).
func NormalizeUsername(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
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
