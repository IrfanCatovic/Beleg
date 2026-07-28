package notifications

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// PushDataExtra builds minimal string push payload fields for mobile resolver parity.
func PushDataExtra(notifType, metadata string) map[string]string {
	extra := map[string]string{"type": notifType}
	meta := map[string]any{}
	if strings := metadata; strings != "" {
		_ = json.Unmarshal([]byte(metadata), &meta)
	}
	copyUintField(extra, meta, "akcijaId")
	copyUintField(extra, meta, "actionId")
	copyUintField(extra, meta, "targetUserId")
	copyUintField(extra, meta, "requesterId")
	copyUintField(extra, meta, "targetId")
	copyUintField(extra, meta, "postId")
	copyUintField(extra, meta, "requestId")
	if v, ok := meta["targetUsername"].(string); ok && v != "" {
		extra["targetUsername"] = v
	}
	if v, ok := meta["requesterUsername"].(string); ok && v != "" {
		extra["requesterUsername"] = v
	}
	return extra
}

func copyUintField(dst map[string]string, meta map[string]any, key string) {
	v, ok := meta[key]
	if !ok || v == nil {
		return
	}
	switch n := v.(type) {
	case float64:
		if n > 0 {
			dst[key] = strconv.FormatUint(uint64(n), 10)
		}
	case json.Number:
		if i, err := n.Int64(); err == nil && i > 0 {
			dst[key] = fmt.Sprintf("%d", i)
		}
	case int:
		if n > 0 {
			dst[key] = strconv.Itoa(n)
		}
	case int64:
		if n > 0 {
			dst[key] = fmt.Sprintf("%d", n)
		}
	case uint:
		if n > 0 {
			dst[key] = fmt.Sprintf("%d", n)
		}
	case uint64:
		if n > 0 {
			dst[key] = fmt.Sprintf("%d", n)
		}
	case string:
		if n != "" && n != "0" {
			dst[key] = n
		}
	}
}
