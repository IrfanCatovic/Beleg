package handlers

import "testing"

func TestAuthorInFeedAllowList(t *testing.T) {
	allowed := []uint{1, 5, 9}
	if !authorInFeedAllowList(allowed, 5) {
		t.Fatal("expected author 5 allowed")
	}
	if authorInFeedAllowList(allowed, 7) {
		t.Fatal("expected author 7 denied")
	}
	if authorInFeedAllowList(nil, 1) {
		t.Fatal("empty allow list denies")
	}
}
