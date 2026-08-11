package socialauth

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "social-token-test-secret-32bytes-ok"

func TestSocialAuth_OnboardingTokenRoundTrip(t *testing.T) {
	raw, err := SignOnboardingToken([]byte(testSecret), "google", "sub-1", "A@B.com", "Irfan", "https://x")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ParseOnboardingToken([]byte(testSecret), raw)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Type != PurposeSocialOnboarding || claims.Purpose != PurposeSocialOnboarding {
		t.Fatalf("type/purpose=%s/%s", claims.Type, claims.Purpose)
	}
	if claims.Provider != "google" || claims.ProviderUserID != "sub-1" || claims.Email != "a@b.com" {
		t.Fatalf("claims=%+v", claims)
	}
	if time.Until(claims.ExpiresAt.Time) > OnboardingTTL+time.Second {
		t.Fatalf("ttl too long: %v", claims.ExpiresAt)
	}
}

func TestSocialAuth_LinkTokenRoundTrip(t *testing.T) {
	raw, err := SignLinkToken([]byte(testSecret), "google", "sub-1", "A@B.com")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ParseLinkToken([]byte(testSecret), raw)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Type != PurposeSocialLink || claims.Purpose != PurposeSocialLink {
		t.Fatalf("type/purpose=%s/%s", claims.Type, claims.Purpose)
	}
	if claims.Email != "a@b.com" {
		t.Fatalf("email=%s", claims.Email)
	}
}

func TestSocialAuth_OnboardingTokenRejectedAsLink(t *testing.T) {
	raw, err := SignOnboardingToken([]byte(testSecret), "google", "sub-1", "a@b.com", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseLinkToken([]byte(testSecret), raw); err == nil {
		t.Fatal("expected purpose mismatch")
	}
}

func TestSocialAuth_ExpiredOnboardingToken(t *testing.T) {
	now := time.Now().Add(-20 * time.Minute)
	claims := OnboardingClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    tokenIssuer,
			Audience:  jwt.ClaimStrings{onboardingAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(OnboardingTTL)),
		},
		Type:           PurposeSocialOnboarding,
		Purpose:        PurposeSocialOnboarding,
		Provider:       "google",
		ProviderUserID: "sub",
		Email:          "a@b.com",
	}
	raw, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatal(err)
	}
	_, err = ParseOnboardingToken([]byte(testSecret), raw)
	if !errors.Is(err, ErrTokenExpired) {
		t.Fatalf("err=%v", err)
	}
}

func TestSocialAuth_SessionJWTNotOnboarding(t *testing.T) {
	claims := jwt.MapClaims{
		"username": "alice",
		"role":     "",
		"purpose":  PurposeSession,
		"exp":      time.Now().Add(time.Hour).Unix(),
	}
	raw, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseOnboardingToken([]byte(testSecret), raw); err == nil {
		t.Fatal("session jwt must not parse as onboarding")
	}
}
