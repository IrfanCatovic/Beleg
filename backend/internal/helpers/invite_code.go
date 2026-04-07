package helpers

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

const (
	InviteCodeLength      = 8
	InviteCodeAlphabet    = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	InviteRegenCooldown   = 12 * time.Hour
	InviteCodeTTL         = 48 * time.Hour
)

// RandomInviteCode generiše 8 znakova iz InviteCodeAlphabet.
func RandomInviteCode() string {
	b := make([]byte, InviteCodeLength)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(InviteCodeAlphabet))))
		if err != nil {
			b[i] = 'A'
			continue
		}
		b[i] = InviteCodeAlphabet[n.Int64()]
	}
	return string(b)
}

// GenerateUniqueInviteCode ponavlja dok ne nađe globalno jedinstven kod.
func GenerateUniqueInviteCode(db *gorm.DB) (string, error) {
	for range 32 {
		code := RandomInviteCode()
		var n int64
		if err := db.Model(&models.Klubovi{}).Where("invite_code = ?", code).Count(&n).Error; err != nil {
			return "", err
		}
		if n == 0 {
			return code, nil
		}
	}
	return "", errors.New("could not generate unique invite code")
}

// RegenAvailableInMs milisekunde do sledećeg dozvoljenog ručnog restarta koda.
func RegenAvailableInMs(lastReg *time.Time, now time.Time) int64 {
	if lastReg == nil {
		return 0
	}
	next := lastReg.Add(InviteRegenCooldown)
	if !now.Before(next) {
		return 0
	}
	return next.Sub(now).Milliseconds()
}

// NormalizeInviteCode trim + upper.
func NormalizeInviteCode(s string) string {
	return strings.ToUpper(strings.TrimSpace(s))
}

// InviteCodeMatchesKlub provera da li kod odgovara klubu i da li je još važeći.
func InviteCodeMatchesKlub(k *models.Klubovi, code string, now time.Time) bool {
	if k.InviteCode == nil || *k.InviteCode == "" {
		return false
	}
	if NormalizeInviteCode(code) != NormalizeInviteCode(*k.InviteCode) {
		return false
	}
	if k.InviteExpiresAt != nil && !now.Before(*k.InviteExpiresAt) {
		return false
	}
	if k.OnHold {
		return false
	}
	return true
}
