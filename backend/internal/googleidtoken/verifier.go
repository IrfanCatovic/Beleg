package googleidtoken

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"google.golang.org/api/idtoken"
)

var (
	ErrInvalidToken          = errors.New("nevažeći Google ID token")
	ErrWrongAudience         = errors.New("Google token nije izdat za ovu aplikaciju")
	ErrExpired               = errors.New("Google token je istekao")
	ErrMissingSub            = errors.New("Google token nema sub")
	ErrMissingEmail          = errors.New("Google token nema email")
	ErrEmailUnverified       = errors.New("Google email nije potvrđen")
	ErrNoAudiencesConfigured = errors.New("GOOGLE_OAUTH_CLIENT_IDS nije konfigurisan")
	ErrInvalidIssuer         = errors.New("Google token ima nevažećeg izdavaoca")
)

// Payload je verifikovani Google identity; nikad se ne puni iz frontend body-ja.
type Payload struct {
	Sub           string
	Email         string
	EmailVerified bool
	Name          string
	Picture       string
	Aud           string
	Iss           string
	Exp           int64
}

// Verifier je mockable Google ID token verifier.
type Verifier interface {
	Verify(ctx context.Context, rawToken string) (*Payload, error)
}

type googleVerifier struct {
	audiences []string
	validate  func(ctx context.Context, token, audience string) (*idtoken.Payload, error)
}

// AudiencesFromEnv parsira GOOGLE_OAUTH_CLIENT_IDS (CSV web, android, ios).
func AudiencesFromEnv() []string {
	return ParseAudiences(os.Getenv("GOOGLE_OAUTH_CLIENT_IDS"))
}

func ParseAudiences(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, p := range parts {
		id := strings.TrimSpace(p)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func NewGoogleVerifier(audiences []string) Verifier {
	return &googleVerifier{
		audiences: audiences,
		validate:  idtoken.Validate,
	}
}

func (v *googleVerifier) Verify(ctx context.Context, rawToken string) (*Payload, error) {
	if len(v.audiences) == 0 {
		return nil, ErrNoAudiencesConfigured
	}
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return nil, ErrInvalidToken
	}

	var lastErr error
	var gp *idtoken.Payload
	for _, aud := range v.audiences {
		p, err := v.validate(ctx, rawToken, aud)
		if err != nil {
			lastErr = err
			continue
		}
		gp = p
		break
	}
	if gp == nil {
		if lastErr != nil && isExpiredErr(lastErr) {
			return nil, ErrExpired
		}
		if lastErr != nil && isAudienceErr(lastErr) {
			return nil, ErrWrongAudience
		}
		return nil, ErrInvalidToken
	}

	if !validGoogleIssuer(gp.Issuer) {
		return nil, ErrInvalidIssuer
	}
	if gp.Expires > 0 && time.Now().Unix() >= gp.Expires {
		return nil, ErrExpired
	}

	out := &Payload{
		Sub:     strings.TrimSpace(gp.Subject),
		Aud:     strings.TrimSpace(gp.Audience),
		Iss:     strings.TrimSpace(gp.Issuer),
		Exp:     gp.Expires,
		Name:    claimString(gp.Claims, "name"),
		Picture: claimString(gp.Claims, "picture"),
		Email:   strings.ToLower(strings.TrimSpace(claimString(gp.Claims, "email"))),
	}
	out.EmailVerified = claimBool(gp.Claims, "email_verified")

	if out.Sub == "" {
		return nil, ErrMissingSub
	}
	if out.Email == "" {
		return nil, ErrMissingEmail
	}
	if !out.EmailVerified {
		return nil, ErrEmailUnverified
	}
	if !audienceAllowed(out.Aud, v.audiences) {
		return nil, ErrWrongAudience
	}
	return out, nil
}

func validGoogleIssuer(iss string) bool {
	switch strings.TrimSpace(iss) {
	case "accounts.google.com", "https://accounts.google.com":
		return true
	default:
		return false
	}
}

func audienceAllowed(aud string, allowed []string) bool {
	aud = strings.TrimSpace(aud)
	for _, a := range allowed {
		if a == aud {
			return true
		}
	}
	return false
}

func claimString(claims map[string]any, key string) string {
	if claims == nil {
		return ""
	}
	v, ok := claims[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprint(t)
	}
}

func claimBool(claims map[string]any, key string) bool {
	if claims == nil {
		return false
	}
	v, ok := claims[key]
	if !ok || v == nil {
		return false
	}
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return strings.EqualFold(strings.TrimSpace(t), "true")
	default:
		return false
	}
}

func isExpiredErr(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "expired") || strings.Contains(msg, "exp")
}

func isAudienceErr(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "audience") || strings.Contains(msg, "aud")
}
