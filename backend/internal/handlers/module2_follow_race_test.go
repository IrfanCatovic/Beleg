package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func callFollowHandler(t *testing.T, db *gorm.DB, user models.Korisnik, fn func(*gin.Context), method, path string, params gin.Params, body []byte) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if body != nil {
		c.Request = httptest.NewRequest(method, path, bytes.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
	} else {
		c.Request = httptest.NewRequest(method, path, nil)
	}
	c.Set("db", db)
	c.Set(middleware.ContextKeyKorisnik, user)
	c.Params = params
	fn(c)
	var m map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &m)
	return w.Code, m
}

func countFollowRows(t *testing.T, db *gorm.DB, requesterID, targetID uint) int64 {
	t.Helper()
	var n int64
	db.Model(&models.Follow{}).Where("requester_id = ? AND target_id = ?", requesterID, targetID).Count(&n)
	return n
}

func countNotifications(t *testing.T, db *gorm.DB, userID uint, notifType string) int64 {
	t.Helper()
	var n int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND type = ?", userID, notifType).Count(&n)
	return n
}

func testFollowRaceDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := testFollowBlockDB(t)
	if err := db.AutoMigrate(&models.Obavestenje{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestFollowRace_AcceptCancel_OneTerminal(t *testing.T) {
	db := testFollowRaceDB(t)
	alice := seedFollowUser(t, db, "race_alice")
	bob := seedFollowUser(t, db, "race_bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}
	if err := db.Create(&f).Error; err != nil {
		t.Fatal(err)
	}
	fid := strconv.FormatUint(uint64(f.ID), 10)
	tid := strconv.FormatUint(uint64(alice.ID), 10)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], _ = callFollowHandler(t, db, bob, AcceptFollowRequestHandler, http.MethodPatch, "/accept/"+fid,
			gin.Params{{Key: "id", Value: fid}}, nil)
	}()
	go func() {
		defer wg.Done()
		codes[1], _ = callFollowHandler(t, db, alice, UnfollowUserHandler, http.MethodDelete, "/unfollow/"+tid,
			gin.Params{{Key: "targetId", Value: tid}}, nil)
	}()
	wg.Wait()

	for _, c := range codes {
		if c == http.StatusInternalServerError {
			t.Fatalf("no 500 allowed, codes=%v", codes)
		}
	}

	rows := countFollowRows(t, db, alice.ID, bob.ID)
	var fRow models.Follow
	err := db.Where("requester_id = ? AND target_id = ?", alice.ID, bob.ID).First(&fRow).Error

	if rows == 0 {
		// cancel won — accept should be 404
		if err == nil && fRow.Status == models.FollowStatusAccepted {
			t.Fatal("cancel won but accepted row remains")
		}
	} else if rows == 1 {
		if fRow.Status != models.FollowStatusAccepted {
			t.Fatalf("accept won but status=%q", fRow.Status)
		}
	} else {
		t.Fatalf("duplicate follow rows=%d", rows)
	}
}

func TestFollowRace_AcceptAccept_Idempotent(t *testing.T) {
	db := testFollowRaceDB(t)
	alice := seedFollowUser(t, db, "aa_alice")
	bob := seedFollowUser(t, db, "aa_bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}
	if err := db.Create(&f).Error; err != nil {
		t.Fatal(err)
	}
	fid := strconv.FormatUint(uint64(f.ID), 10)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], _ = callFollowHandler(t, db, bob, AcceptFollowRequestHandler, http.MethodPatch, "/accept/"+fid,
			gin.Params{{Key: "id", Value: fid}}, nil)
	}()
	go func() {
		defer wg.Done()
		codes[1], _ = callFollowHandler(t, db, bob, AcceptFollowRequestHandler, http.MethodPatch, "/accept/"+fid,
			gin.Params{{Key: "id", Value: fid}}, nil)
	}()
	wg.Wait()

	ok := 0
	for _, c := range codes {
		if c == http.StatusOK {
			ok++
		}
		if c == http.StatusInternalServerError {
			t.Fatalf("panic/500 codes=%v", codes)
		}
	}
	if ok < 1 {
		t.Fatalf("at least one accept must succeed, codes=%v", codes)
	}

	var fRow models.Follow
	if err := db.First(&fRow, f.ID).Error; err != nil {
		t.Fatal(err)
	}
	if fRow.Status != models.FollowStatusAccepted {
		t.Fatalf("status=%q", fRow.Status)
	}
	if countFollowRows(t, db, alice.ID, bob.ID) != 1 {
		t.Fatal("exactly one follow row")
	}
	notifs := countNotifications(t, db, alice.ID, models.ObavestenjeTipFollow)
	if notifs > 1 {
		t.Fatalf("at most 1 accept notification, got %d", notifs)
	}
}

func TestFollowRace_BlockFollow_SerializedBlockWins(t *testing.T) {
	const iterations = 20
	for i := 0; i < iterations; i++ {
		db := testFollowRaceDB(t)
		alice := seedFollowUser(t, db, "ser_alice_"+strconv.Itoa(i))
		bob := seedFollowUser(t, db, "ser_bob_"+strconv.Itoa(i))

		body, _ := json.Marshal(CreateFollowRequest{TargetID: bob.ID})
		tid := strconv.FormatUint(uint64(alice.ID), 10)

		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			callFollowHandler(t, db, alice, CreateFollowRequestHandler, http.MethodPost, "/requests", nil, body)
		}()
		go func() {
			defer wg.Done()
			callFollowHandler(t, db, bob, BlockUserHandler, http.MethodPost, "/blocks/"+tid,
				gin.Params{{Key: "targetId", Value: tid}}, nil)
		}()
		wg.Wait()

		var blockCnt, followCnt int64
		db.Model(&models.Block{}).Where("blocker_id = ? AND blocked_id = ?", bob.ID, alice.ID).Count(&blockCnt)
		db.Model(&models.Follow{}).
			Where("(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)", alice.ID, bob.ID, bob.ID, alice.ID).
			Count(&followCnt)
		if blockCnt != 1 || followCnt != 0 {
			t.Fatalf("iter=%d block=%d follow=%d want block=1 follow=0", i, blockCnt, followCnt)
		}
	}
}

func TestFollowRace_BlockFollowRequest_NoFollowInDB(t *testing.T) {
	const iterations = 30
	staleFound := false
	for i := 0; i < iterations; i++ {
		db := testFollowRaceDB(t)
		alice := seedFollowUser(t, db, "bf_alice")
		bob := seedFollowUser(t, db, "bf_bob")

		body, _ := json.Marshal(CreateFollowRequest{TargetID: bob.ID})
		tid := strconv.FormatUint(uint64(alice.ID), 10)

		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			callFollowHandler(t, db, alice, CreateFollowRequestHandler, http.MethodPost, "/requests", nil, body)
		}()
		go func() {
			defer wg.Done()
			callFollowHandler(t, db, bob, BlockUserHandler, http.MethodPost, "/blocks/"+tid,
				gin.Params{{Key: "targetId", Value: tid}}, nil)
		}()
		wg.Wait()

		var followCnt int64
		db.Model(&models.Follow{}).
			Where("(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)", alice.ID, bob.ID, bob.ID, alice.ID).
			Count(&followCnt)
		if followCnt != 0 {
			staleFound = true
			t.Logf("M2-RACE-BF-1 iter=%d: block×follow race left follow rows=%d in DB", i, followCnt)
		}
	}
	if staleFound {
		t.Fatalf("M2-RACE-BF-1 P2: parallel block×follow race produced stale follow rows in at least one iteration")
	}
}

func TestFollowRace_BlockFollowRequest_ReverseDirection(t *testing.T) {
	const iterations = 30
	staleFound := false
	for i := 0; i < iterations; i++ {
		db := testFollowRaceDB(t)
		alice := seedFollowUser(t, db, "bfr_alice")
		bob := seedFollowUser(t, db, "bfr_bob")

		body, _ := json.Marshal(CreateFollowRequest{TargetID: alice.ID})
		tid := strconv.FormatUint(uint64(bob.ID), 10)

		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			callFollowHandler(t, db, bob, CreateFollowRequestHandler, http.MethodPost, "/requests", nil, body)
		}()
		go func() {
			defer wg.Done()
			callFollowHandler(t, db, alice, BlockUserHandler, http.MethodPost, "/blocks/"+tid,
				gin.Params{{Key: "targetId", Value: tid}}, nil)
		}()
		wg.Wait()

		var followCnt int64
		db.Model(&models.Follow{}).
			Where("(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)", alice.ID, bob.ID, bob.ID, alice.ID).
			Count(&followCnt)
		if followCnt != 0 {
			staleFound = true
			t.Logf("M2-RACE-BF-1 reverse iter=%d: left follow rows=%d", i, followCnt)
		}
	}
	if staleFound {
		t.Fatalf("M2-RACE-BF-1 P2: reverse block×follow race produced stale follow rows")
	}
}

func TestFollowRace_BlockAccept_NoFollowInDB(t *testing.T) {
	db := testFollowRaceDB(t)
	alice := seedFollowUser(t, db, "ba_alice")
	bob := seedFollowUser(t, db, "ba_bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}
	if err := db.Create(&f).Error; err != nil {
		t.Fatal(err)
	}
	fid := strconv.FormatUint(uint64(f.ID), 10)
	tid := strconv.FormatUint(uint64(alice.ID), 10)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		callFollowHandler(t, db, bob, AcceptFollowRequestHandler, http.MethodPatch, "/accept/"+fid,
			gin.Params{{Key: "id", Value: fid}}, nil)
	}()
	go func() {
		defer wg.Done()
		callFollowHandler(t, db, bob, BlockUserHandler, http.MethodPost, "/blocks/"+tid,
			gin.Params{{Key: "targetId", Value: tid}}, nil)
	}()
	wg.Wait()

	var blockCnt int64
	db.Model(&models.Block{}).Where("blocker_id = ? AND blocked_id = ?", bob.ID, alice.ID).Count(&blockCnt)

	var acceptedCnt int64
	db.Model(&models.Follow{}).
		Where("requester_id = ? AND target_id = ? AND status = ?", alice.ID, bob.ID, models.FollowStatusAccepted).
		Count(&acceptedCnt)

	if blockCnt == 1 && acceptedCnt > 0 {
		t.Fatalf("M2-RACE-BA-1: block exists but accepted follow also exists")
	}
}

func TestFollowRace_UnfollowBlock_NoFollowInDB(t *testing.T) {
	db := testFollowRaceDB(t)
	alice := seedFollowUser(t, db, "ub_alice")
	bob := seedFollowUser(t, db, "ub_bob")
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted})
	tid := strconv.FormatUint(uint64(bob.ID), 10)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		callFollowHandler(t, db, alice, UnfollowUserHandler, http.MethodDelete, "/unfollow/"+tid,
			gin.Params{{Key: "targetId", Value: tid}}, nil)
	}()
	go func() {
		defer wg.Done()
		callFollowHandler(t, db, alice, BlockUserHandler, http.MethodPost, "/blocks/"+tid,
			gin.Params{{Key: "targetId", Value: tid}}, nil)
	}()
	wg.Wait()

	var followCnt int64
	db.Model(&models.Follow{}).Where("requester_id = ? AND target_id = ?", alice.ID, bob.ID).Count(&followCnt)
	if followCnt != 0 {
		t.Fatalf("unfollow×block left follow rows=%d", followCnt)
	}
	var blockCnt int64
	db.Model(&models.Block{}).Where("blocker_id = ? AND blocked_id = ?", alice.ID, bob.ID).Count(&blockCnt)
	if blockCnt != 1 {
		t.Fatalf("block must exist, count=%d", blockCnt)
	}
}

func TestFollowRace_DuplicateRequest_OneRow(t *testing.T) {
	db := testFollowRaceDB(t)
	alice := seedFollowUser(t, db, "dup_alice")
	bob := seedFollowUser(t, db, "dup_bob")
	body, _ := json.Marshal(CreateFollowRequest{TargetID: bob.ID})

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callFollowHandler(t, db, alice, CreateFollowRequestHandler, http.MethodPost, "/requests", nil, body)
		}(i)
	}
	wg.Wait()

	if countFollowRows(t, db, alice.ID, bob.ID) != 1 {
		t.Fatalf("duplicate parallel requests must leave one follow row")
	}
	for _, c := range codes {
		if c != http.StatusCreated && c != http.StatusOK {
			if c == http.StatusInternalServerError {
				t.Fatalf("500 on duplicate request race codes=%v", codes)
			}
		}
	}
}

func TestFollowCounts_AfterAcceptCancelRace_Consistent(t *testing.T) {
	db := testFollowRaceDB(t)
	alice := seedFollowUser(t, db, "cnt_alice")
	bob := seedFollowUser(t, db, "cnt_bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}
	_ = db.Create(&f)
	fid := strconv.FormatUint(uint64(f.ID), 10)
	tid := strconv.FormatUint(uint64(alice.ID), 10)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		callFollowHandler(t, db, bob, AcceptFollowRequestHandler, http.MethodPatch, "/accept/"+fid,
			gin.Params{{Key: "id", Value: fid}}, nil)
	}()
	go func() {
		defer wg.Done()
		callFollowHandler(t, db, alice, UnfollowUserHandler, http.MethodDelete, "/unfollow/"+tid,
			gin.Params{{Key: "targetId", Value: tid}}, nil)
	}()
	wg.Wait()

	w, c := withUserContext(t, db, bob, http.MethodGet, "/api/follows/user/cnt_bob/counts", nil)
	c.Params = gin.Params{{Key: "id", Value: "cnt_bob"}}
	GetFollowCountsHandler(c)
	var counts FollowCountsResponse
	_ = json.Unmarshal(w.Body.Bytes(), &counts)

	w2, c2 := withUserContext(t, db, bob, http.MethodGet, "/api/follows/user/cnt_bob/followers", nil)
	c2.Params = gin.Params{{Key: "id", Value: "cnt_bob"}}
	GetFollowersListHandler(c2)
	var listBody map[string]any
	_ = json.Unmarshal(w2.Body.Bytes(), &listBody)
	users, _ := listBody["users"].([]any)

	if counts.Followers != int64(len(users)) {
		t.Fatalf("counts=%d list=%d mismatch after race", counts.Followers, len(users))
	}
}
