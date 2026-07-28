package notifications

import "testing"

func TestPushDataExtra_IncludesResolverFields(t *testing.T) {
	meta := MarshalMetadata(ProfileNotificationMetadata(7, "ana", map[string]any{
		"postId": uint(99),
	}))
	extra := PushDataExtra("follow", meta)
	if extra["type"] != "follow" {
		t.Fatalf("type=%q", extra["type"])
	}
	if extra["targetUserId"] != "7" {
		t.Fatalf("targetUserId=%q", extra["targetUserId"])
	}
	if extra["targetUsername"] != "ana" {
		t.Fatalf("targetUsername=%q", extra["targetUsername"])
	}
	if extra["postId"] != "99" {
		t.Fatalf("postId=%q", extra["postId"])
	}
}

func TestActionNotificationMetadata_BothIDKeys(t *testing.T) {
	meta := ActionNotificationMetadata(12, map[string]any{"requestId": 3})
	if meta["akcijaId"] != uint(12) || meta["actionId"] != uint(12) {
		t.Fatalf("meta=%v", meta)
	}
	if meta["requestId"] != 3 {
		t.Fatalf("requestId=%v", meta["requestId"])
	}
}
