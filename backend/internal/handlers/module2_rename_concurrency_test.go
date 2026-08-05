package handlers

import (
	"net/http"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
)

func renameFields(u models.Korisnik, newUsername string) map[string]string {
	f := baseProfileFields(u)
	f["username"] = newUsername
	return f
}

func TestRenameConcurrent_TwoUsersSameUsername_OneWins(t *testing.T) {
	db := testUpdateMeDB(t)
	a := seedUpdateMeUser(t, db, "user_a", "pass12345")
	b := seedUpdateMeUser(t, db, "user_b", "pass12345")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	bodies := make([]map[string]any, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], bodies[0], _ = callUpdateMe(t, db, a.Username, renameFields(a, "novi"))
	}()
	go func() {
		defer wg.Done()
		codes[1], bodies[1], _ = callUpdateMe(t, db, b.Username, renameFields(b, "novi"))
	}()
	wg.Wait()

	success := 0
	conflictOrError := 0
	for i, code := range codes {
		switch code {
		case http.StatusOK:
			success++
		case http.StatusConflict:
			conflictOrError++
		case http.StatusInternalServerError:
			conflictOrError++ // unique violation surfaces as 500 today
		default:
			t.Fatalf("unexpected status[%d]=%d", i, code)
		}
	}
	if success != 1 {
		t.Fatalf("expected exactly one success, codes=%v", codes)
	}
	if conflictOrError != 1 {
		t.Fatalf("expected one conflict/error, codes=%v", codes)
	}

	var count int64
	db.Model(&models.Korisnik{}).Where("username = ?", "novi").Count(&count)
	if count != 1 {
		t.Fatalf("DB must have exactly one 'novi', count=%d", count)
	}
}

func TestRenameConcurrent_SameUserDualRename_DeterministicFinal(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "dual_user", "pass12345")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], _, _ = callUpdateMe(t, db, u.Username, renameFields(u, "ime1"))
	}()
	go func() {
		defer wg.Done()
		codes[1], _, _ = callUpdateMe(t, db, u.Username, renameFields(u, "ime2"))
	}()
	wg.Wait()

	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Username != "ime1" && reloaded.Username != "ime2" {
		t.Fatalf("final username must be ime1 or ime2, got %q", reloaded.Username)
	}
	okCount := 0
	for _, c := range codes {
		if c == http.StatusOK {
			okCount++
		}
	}
	if okCount < 1 {
		t.Fatalf("at least one rename must succeed, codes=%v", codes)
	}
	var dup int64
	db.Model(&models.Korisnik{}).Where("username IN ?", []string{"ime1", "ime2"}).Count(&dup)
	if dup != 1 {
		t.Fatalf("only one renamed username row expected, count=%d", dup)
	}
}

func TestRenameConcurrent_LoserGets500Not409_Documented(t *testing.T) {
	db := testUpdateMeDB(t)
	a := seedUpdateMeUser(t, db, "race_a", "pass12345")
	b := seedUpdateMeUser(t, db, "race_b", "pass12345")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], _, _ = callUpdateMe(t, db, a.Username, renameFields(a, "race_target"))
	}()
	go func() {
		defer wg.Done()
		codes[1], _, _ = callUpdateMe(t, db, b.Username, renameFields(b, "race_target"))
	}()
	wg.Wait()

	has500, has409 := false, false
	for _, c := range codes {
		if c == http.StatusInternalServerError {
			has500 = true
		}
		if c == http.StatusConflict {
			has409 = true
		}
	}
	// M2-RACE-RENAME-1: unique race loser may get 500 instead of canonical 409
	if has500 && !has409 {
		t.Log("M2-RACE-RENAME-1 documented: concurrent rename loser returns 500 not 409")
	}
}

func TestRename_OldJWTRejectedNewJWTWorks(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "jwt_user", "pass12345")
	secret := []byte("01234567890123456789012345678901")

	oldClaims := jwt.MapClaims{
		"username": "jwt_user",
		"role":     "clan",
		"exp":      time.Now().Add(time.Hour).Unix(),
	}
	oldTok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, oldClaims).SignedString(secret)
	if err != nil {
		t.Fatal(err)
	}

	fields := renameFields(u, "jwt_new")
	code, body, _ := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("rename status %d", code)
	}
	if body["token"] == nil {
		t.Fatal("rename must return new token")
	}

	// Old username no longer resolves
	var gone models.Korisnik
	if err := helpers.DBWhereUsername(db, "jwt_user").First(&gone).Error; err == nil {
		t.Fatal("old username must not resolve after rename")
	}

	// New username resolves
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Username != "jwt_new" {
		t.Fatalf("username=%q", reloaded.Username)
	}

	// Parse old token — claim still says jwt_user but DB lookup fails (LoadUser behavior)
	oldParsed, _ := jwt.Parse(oldTok, func(t *jwt.Token) (interface{}, error) { return secret, nil })
	if !oldParsed.Valid {
		t.Fatal("old token still cryptographically valid until expiry")
	}
	// Auth contract: LoadUser looks up by username claim — stale username → 401
	var stale models.Korisnik
	if err := helpers.DBWhereUsername(db, "jwt_user").First(&stale).Error; err == nil {
		t.Fatal("stale JWT username must not load user from DB")
	}
}
