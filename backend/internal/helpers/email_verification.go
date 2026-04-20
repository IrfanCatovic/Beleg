package helpers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
)

func GenerateEmailVerificationToken() (rawToken string, tokenHash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", err
	}
	rawToken = base64.RawURLEncoding.EncodeToString(buf)
	tokenHash = HashEmailVerificationToken(rawToken)
	return rawToken, tokenHash, nil
}

func HashEmailVerificationToken(raw string) string {
	normalized := strings.TrimSpace(raw)
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}
