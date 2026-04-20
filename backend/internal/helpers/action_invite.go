package helpers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
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
