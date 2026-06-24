package helpers

import (
	"testing"
	"time"

	"beleg-app/backend/internal/models"
)

func TestNormalizeInviteCode(t *testing.T) {
	if got := NormalizeInviteCode("  abcd12  "); got != "ABCD12" {
		t.Fatalf("expected ABCD12, got %q", got)
	}
}

func TestRegenAvailableInMs(t *testing.T) {
	now := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	last := now.Add(-InviteRegenCooldown)
	if ms := RegenAvailableInMs(&last, now); ms != 0 {
		t.Fatalf("expected 0 ms remaining after cooldown, got %d", ms)
	}
	future := now.Add(-1 * time.Hour)
	if ms := RegenAvailableInMs(&future, now); ms <= 0 {
		t.Fatalf("expected positive cooldown, got %d", ms)
	}
	if RegenAvailableInMs(nil, now) != 0 {
		t.Fatal("nil last reg should return 0")
	}
}

func TestInviteCodeExpired(t *testing.T) {
	now := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	code := "ABC12345"
	expired := now.Add(-time.Hour)
	k := models.Klubovi{InviteCode: &code, InviteExpiresAt: &expired}
	if !InviteCodeExpired(&k, now) {
		t.Fatal("expected expired invite code")
	}
	validUntil := now.Add(time.Hour)
	k.InviteExpiresAt = &validUntil
	if InviteCodeExpired(&k, now) {
		t.Fatal("expected valid invite code")
	}
}

func TestInviteCodeMatchesKlub(t *testing.T) {
	now := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	code := "XYZ98765"
	validUntil := now.Add(24 * time.Hour)
	k := models.Klubovi{InviteCode: &code, InviteExpiresAt: &validUntil, OnHold: false}
	if !InviteCodeMatchesKlub(&k, " xyz98765 ", now) {
		t.Fatal("expected matching code")
	}
	k.OnHold = true
	if InviteCodeMatchesKlub(&k, code, now) {
		t.Fatal("on-hold club should not match")
	}
}

func TestRandomInviteCodeLength(t *testing.T) {
	code := RandomInviteCode()
	if len(code) != InviteCodeLength {
		t.Fatalf("expected length %d, got %d", InviteCodeLength, len(code))
	}
}
