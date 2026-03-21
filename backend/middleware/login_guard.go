package middleware

import (
	"strings"
	"sync"
	"time"
)

type loginAttemptEntry struct {
	failCount  int
	lastFailAt time.Time
	lockedUntil time.Time
}

var (
	loginMu       sync.Mutex
	loginAttempts = map[string]loginAttemptEntry{}
)

const (
	loginMaxFails       = 5
	loginFailWindow     = 15 * time.Minute
	loginLockDuration   = 15 * time.Minute
)

func loginAttemptKey(ip, username string) string {
	return strings.TrimSpace(ip) + "|" + strings.ToLower(strings.TrimSpace(username))
}

// CheckLoginAllowed proverava da li je pokušaj logina privremeno blokiran.
// Vraća allowed=false i lock-until vreme ako je blokada aktivna.
func CheckLoginAllowed(ip, username string) (bool, time.Time) {
	now := time.Now()
	key := loginAttemptKey(ip, username)

	loginMu.Lock()
	defer loginMu.Unlock()

	for k, v := range loginAttempts {
		if !v.lockedUntil.IsZero() && now.After(v.lockedUntil) {
			delete(loginAttempts, k)
			continue
		}
		if v.lockedUntil.IsZero() && now.Sub(v.lastFailAt) > loginFailWindow {
			delete(loginAttempts, k)
		}
	}

	entry, ok := loginAttempts[key]
	if !ok || entry.lockedUntil.IsZero() || now.After(entry.lockedUntil) {
		return true, time.Time{}
	}
	return false, entry.lockedUntil
}

// RegisterLoginFailure beleži neuspešan login i aktivira lockout kad pređe prag.
func RegisterLoginFailure(ip, username string) {
	now := time.Now()
	key := loginAttemptKey(ip, username)

	loginMu.Lock()
	defer loginMu.Unlock()

	entry := loginAttempts[key]
	if entry.lastFailAt.IsZero() || now.Sub(entry.lastFailAt) > loginFailWindow {
		entry.failCount = 0
		entry.lockedUntil = time.Time{}
	}
	entry.failCount++
	entry.lastFailAt = now
	if entry.failCount >= loginMaxFails {
		entry.lockedUntil = now.Add(loginLockDuration)
	}
	loginAttempts[key] = entry
}

// RegisterLoginSuccess briše evidenciju neuspeha nakon uspešnog logina.
func RegisterLoginSuccess(ip, username string) {
	key := loginAttemptKey(ip, username)
	loginMu.Lock()
	delete(loginAttempts, key)
	loginMu.Unlock()
}
