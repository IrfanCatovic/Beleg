package socialauth

import "testing"

func TestSocialAuth_SuggestUsername_Transliteration(t *testing.T) {
	got := SuggestUsername(nil, "Irfan Ćatović", "other@example.com")
	if got != "irfancatovic" {
		t.Fatalf("got=%q want irfancatovic", got)
	}
}

func TestSocialAuth_SuggestUsername_AllSouthSlavicLetters(t *testing.T) {
	got := SuggestUsername(nil, "ČĆŠŽĐ čćšžđ", "")
	if got != "ccszdjccszdj" {
		t.Fatalf("got=%q", got)
	}
}

func TestSocialAuth_SuggestUsername_FallsBackToEmailLocal(t *testing.T) {
	got := SuggestUsername(nil, "!", "Planiner.User@example.com")
	if got != "planineruser" {
		t.Fatalf("got=%q want planineruser", got)
	}
}

func TestSocialAuth_UsernameSeed_ShortNameFallsBack(t *testing.T) {
	if usernameSeed("A", "ab@example.com") != "ab" {
		t.Fatalf("got=%q", usernameSeed("A", "ab@example.com"))
	}
}
