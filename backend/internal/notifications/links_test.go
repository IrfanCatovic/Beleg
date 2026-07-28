package notifications

import (
	"net/url"
	"strings"
	"testing"
)

func TestBuildActionNotificationLink(t *testing.T) {
	tests := []struct {
		name        string
		id          uint
		claimReward bool
		want        string
	}{
		{"plain", 12, false, "/akcije/12"},
		{"claim", 12, true, "/akcije/12?claimReward=1"},
		{"zero", 0, false, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := BuildActionNotificationLink(tc.id, tc.claimReward); got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
		})
	}
}

func TestBuildProfileNotificationLink(t *testing.T) {
	tests := []struct {
		name     string
		username string
		want     string
	}{
		{"simple", "amar", "/korisnik/amar"},
		{"space", "Demo user", "/korisnik/Demo%20user"},
		{"plus", "a+b", "/korisnik/a+b"},
		{"slash", "a/b", "/korisnik/a%2Fb"},
		{"question", "a?b", "/korisnik/a%3Fb"},
		{"hash", "a#b", "/korisnik/a%23b"},
		{"unicode", "ćirilica", "/korisnik/" + url.PathEscape("ćirilica")},
		{"whitespace", "  ", ""},
		{"empty", "", ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := BuildProfileNotificationLink(tc.username)
			if got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
			if got == "" {
				return
			}
			seg := strings.TrimPrefix(got, "/korisnik/")
			if _, err := url.PathUnescape(seg); err != nil {
				t.Fatalf("path unescape failed: %v", err)
			}
		})
	}
}

func TestStaticNotificationLinks(t *testing.T) {
	if BuildOwnClubNotificationLink() != "/klub" {
		t.Fatal("own club")
	}
	if BuildTasksNotificationLink() != "/zadaci" {
		t.Fatal("tasks")
	}
	if BuildFinancesNotificationLink() != "/finansije" {
		t.Fatal("finances")
	}
	if BuildHomeNotificationLink() != "/home" {
		t.Fatal("home")
	}
	if BuildGuidesNotificationLink() != "/vodici" {
		t.Fatal("guides")
	}
}
