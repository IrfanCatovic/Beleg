package notifications

import (
	"fmt"
	"net/url"
	"strings"
)

// BuildActionNotificationLink returns a canonical action path or "" when actionID is 0.
func BuildActionNotificationLink(actionID uint, claimReward bool) string {
	if actionID == 0 {
		return ""
	}
	if claimReward {
		return fmt.Sprintf("/akcije/%d?claimReward=1", actionID)
	}
	return fmt.Sprintf("/akcije/%d", actionID)
}

// EscapePathSegment safely encodes one URL path segment (username, club name, …).
func EscapePathSegment(segment string) string {
	return url.PathEscape(strings.TrimSpace(segment))
}

// BuildProfileNotificationLink returns /korisnik/{escapedUsername} or "" when username is empty.
func BuildProfileNotificationLink(username string) string {
	u := strings.TrimSpace(username)
	if u == "" {
		return ""
	}
	return "/korisnik/" + EscapePathSegment(u)
}

func BuildOwnClubNotificationLink() string  { return "/klub" }
func BuildTasksNotificationLink() string    { return "/zadaci" }
func BuildFinancesNotificationLink() string { return "/finansije" }
func BuildHomeNotificationLink() string     { return "/home" }
func BuildGuidesNotificationLink() string   { return "/vodici" }
