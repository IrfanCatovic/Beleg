package helpers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func GenerateActionInviteToken() (rawToken string, tokenHash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", err
	}
	rawToken = base64.RawURLEncoding.EncodeToString(buf)
	tokenHash = HashActionInviteToken(rawToken)
	return rawToken, tokenHash, nil
}

func HashActionInviteToken(raw string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(raw)))
	return hex.EncodeToString(sum[:])
}

// RevokeActiveActionInviteLinksTx postavlja RevokedAt na sve nerevokovane invite linkove akcije.
// Ne briše linkove, ne mijenja ExpiresAt, ne otvara transakciju.
func RevokeActiveActionInviteLinksTx(
	tx *gorm.DB,
	akcijaID uint,
	revokedAt time.Time,
) (int64, error) {
	res := tx.Model(&models.ActionInviteLink{}).
		Where("akcija_id = ? AND revoked_at IS NULL", akcijaID).
		Update("revoked_at", revokedAt)
	return res.RowsAffected, res.Error
}
