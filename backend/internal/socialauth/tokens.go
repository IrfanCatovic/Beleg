package socialauth

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	PurposeSession          = "session"
	PurposeSocialOnboarding = "social_onboarding"
	PurposeSocialLink       = "social_link"
	onboardingAudience      = "planiner-social-onboarding"
	linkAudience            = "planiner-social-link"
	tokenIssuer             = "planiner"
	OnboardingTTL           = 15 * time.Minute
	LinkTTL                 = 15 * time.Minute
)

var (
	ErrTokenInvalid = errors.New("nevažeći token")
	ErrTokenExpired = errors.New("token je istekao")
	ErrTokenPurpose = errors.New("token nije namijenjen za ovu operaciju")
)

type OnboardingClaims struct {
	jwt.RegisteredClaims
	Type           string `json:"type"`
	Purpose        string `json:"purpose"`
	Provider       string `json:"provider"`
	ProviderUserID string `json:"providerUserId"`
	Email          string `json:"email"`
	FullName       string `json:"fullName"`
	AvatarURL      string `json:"avatarUrl"`
}

type LinkClaims struct {
	jwt.RegisteredClaims
	Type           string `json:"type"`
	Purpose        string `json:"purpose"`
	Provider       string `json:"provider"`
	ProviderUserID string `json:"providerUserId"`
	Email          string `json:"email"`
}

func SignOnboardingToken(secret []byte, provider, sub, email, fullName, avatarURL string) (string, error) {
	now := time.Now()
	claims := OnboardingClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    tokenIssuer,
			Audience:  jwt.ClaimStrings{onboardingAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(OnboardingTTL)),
		},
		Type:           PurposeSocialOnboarding,
		Purpose:        PurposeSocialOnboarding,
		Provider:       provider,
		ProviderUserID: sub,
		Email:          strings.ToLower(strings.TrimSpace(email)),
		FullName:       fullName,
		AvatarURL:      avatarURL,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func ParseOnboardingToken(secret []byte, raw string) (*OnboardingClaims, error) {
	claims := &OnboardingClaims{}
	token, err := jwt.ParseWithClaims(strings.TrimSpace(raw), claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrTokenInvalid
		}
		return secret, nil
	}, jwt.WithAudience(onboardingAudience), jwt.WithIssuer(tokenIssuer))
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrTokenInvalid
	}
	if !token.Valid || claims.Purpose != PurposeSocialOnboarding || claims.Type != PurposeSocialOnboarding {
		return nil, ErrTokenPurpose
	}
	if strings.TrimSpace(claims.ProviderUserID) == "" || strings.TrimSpace(claims.Email) == "" {
		return nil, ErrTokenInvalid
	}
	return claims, nil
}

func SignLinkToken(secret []byte, provider, sub, email string) (string, error) {
	now := time.Now()
	claims := LinkClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    tokenIssuer,
			Audience:  jwt.ClaimStrings{linkAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(LinkTTL)),
		},
		Type:           PurposeSocialLink,
		Purpose:        PurposeSocialLink,
		Provider:       provider,
		ProviderUserID: sub,
		Email:          strings.ToLower(strings.TrimSpace(email)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func ParseLinkToken(secret []byte, raw string) (*LinkClaims, error) {
	claims := &LinkClaims{}
	token, err := jwt.ParseWithClaims(strings.TrimSpace(raw), claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrTokenInvalid
		}
		return secret, nil
	}, jwt.WithAudience(linkAudience), jwt.WithIssuer(tokenIssuer))
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrTokenInvalid
	}
	if !token.Valid || claims.Purpose != PurposeSocialLink || claims.Type != PurposeSocialLink {
		return nil, ErrTokenPurpose
	}
	if strings.TrimSpace(claims.ProviderUserID) == "" || strings.TrimSpace(claims.Email) == "" {
		return nil, ErrTokenInvalid
	}
	return claims, nil
}
