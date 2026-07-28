package notifications

import (
	"encoding/json"
	"strings"
)

func mergeMetadata(base map[string]any, extra map[string]any) map[string]any {
	out := make(map[string]any, len(base)+len(extra))
	for k, v := range base {
		out[k] = v
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

// ProfileNotificationMetadata stores stable profile navigation fields for the actor/target user.
func ProfileNotificationMetadata(userID uint, username string, extra map[string]any) map[string]any {
	base := map[string]any{}
	if userID > 0 {
		base["targetUserId"] = userID
	}
	if u := strings.TrimSpace(username); u != "" {
		base["targetUsername"] = u
	}
	return mergeMetadata(base, extra)
}

// ActionNotificationMetadata stores both akcijaId and actionId for resolver compatibility.
func ActionNotificationMetadata(actionID uint, extra map[string]any) map[string]any {
	base := map[string]any{}
	if actionID > 0 {
		base["akcijaId"] = actionID
		base["actionId"] = actionID
	}
	return mergeMetadata(base, extra)
}

// PostNotificationMetadata stores post + actor fields for home/feed navigation.
func PostNotificationMetadata(postID, actorUserID uint, actorUsername string, extra map[string]any) map[string]any {
	base := map[string]any{"postId": postID}
	if actorUserID > 0 {
		base["actorUserId"] = actorUserID
	}
	if u := strings.TrimSpace(actorUsername); u != "" {
		base["actorUsername"] = u
	}
	return mergeMetadata(base, extra)
}

// MarshalMetadata JSON-encodes metadata; returns "" on failure.
func MarshalMetadata(meta map[string]any) string {
	if len(meta) == 0 {
		return ""
	}
	b, err := json.Marshal(meta)
	if err != nil {
		return ""
	}
	return string(b)
}
