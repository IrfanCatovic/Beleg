package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testFollowBlockDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "follow_block")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}, &models.Follow{}, &models.Block{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedFollowUser(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan", FullName: username}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func withUserContext(t *testing.T, db *gorm.DB, user models.Korisnik, method, path string, body []byte) (*httptest.ResponseRecorder, *gin.Context) {
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
	return w, c
}

func TestCreateFollowRequest_ValidPending(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")

	body, _ := json.Marshal(CreateFollowRequest{TargetID: bob.ID})
	w, c := withUserContext(t, db, alice, http.MethodPost, "/api/follows/requests", body)
	CreateFollowRequestHandler(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
	var f models.Follow
	if err := db.Where("requester_id = ? AND target_id = ?", alice.ID, bob.ID).First(&f).Error; err != nil {
		t.Fatal(err)
	}
	if f.Status != models.FollowStatusPending {
		t.Fatalf("status=%q", f.Status)
	}
}

func TestCreateFollowRequest_SelfRejected(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	body, _ := json.Marshal(CreateFollowRequest{TargetID: alice.ID})
	w, c := withUserContext(t, db, alice, http.MethodPost, "/api/follows/requests", body)
	CreateFollowRequestHandler(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status %d", w.Code)
	}
}

func TestCreateFollowRequest_BlockedForbidden(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	if err := db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID}).Error; err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(CreateFollowRequest{TargetID: bob.ID})
	w, c := withUserContext(t, db, alice, http.MethodPost, "/api/follows/requests", body)
	CreateFollowRequestHandler(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
}

func TestCreateFollowRequest_IdempotentExisting(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}
	if err := db.Create(&f).Error; err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(CreateFollowRequest{TargetID: bob.ID})
	w, c := withUserContext(t, db, alice, http.MethodPost, "/api/follows/requests", body)
	CreateFollowRequestHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
}

func TestAcceptFollowRequest_OnlyTarget(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}
	if err := db.Create(&f).Error; err != nil {
		t.Fatal(err)
	}

	w, c := withUserContext(t, db, bob, http.MethodPatch, "/api/follows/requests/"+strconv.FormatUint(uint64(f.ID), 10)+"/accept", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(f.ID), 10)}}
	AcceptFollowRequestHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
	db.First(&f, f.ID)
	if f.Status != models.FollowStatusAccepted {
		t.Fatalf("status=%q", f.Status)
	}

	// requester cannot accept own request
	w2, c2 := withUserContext(t, db, alice, http.MethodPatch, "/api/follows/requests/"+strconv.FormatUint(uint64(f.ID), 10)+"/accept", nil)
	c2.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(f.ID), 10)}}
	AcceptFollowRequestHandler(c2)
	if w2.Code != http.StatusNotFound {
		t.Fatalf("requester accept status %d", w2.Code)
	}
}

func TestRejectFollowRequest_OnlyTarget(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}
	if err := db.Create(&f).Error; err != nil {
		t.Fatal(err)
	}
	w, c := withUserContext(t, db, bob, http.MethodDelete, "/api/follows/requests/"+strconv.FormatUint(uint64(f.ID), 10), nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(f.ID), 10)}}
	RejectFollowRequestHandler(c)
	if w.Body.Len() > 0 {
		t.Fatalf("unexpected body status=%d body=%s", w.Code, w.Body.String())
	}
	var cnt int64
	db.Model(&models.Follow{}).Count(&cnt)
	if cnt != 0 {
		t.Fatalf("follow rows=%d", cnt)
	}
}

func TestUnfollowUser_RemovesOutgoing(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	if err := db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted}).Error; err != nil {
		t.Fatal(err)
	}
	w, c := withUserContext(t, db, alice, http.MethodDelete, "/api/follows/user/"+strconv.FormatUint(uint64(bob.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(bob.ID), 10)}}
	UnfollowUserHandler(c)
	if w.Body.Len() > 0 {
		t.Fatalf("unexpected body status=%d body=%s", w.Code, w.Body.String())
	}
	var cnt int64
	db.Model(&models.Follow{}).Count(&cnt)
	if cnt != 0 {
		t.Fatalf("follow rows=%d", cnt)
	}
}

func TestGetFollowStatus_BothDirections(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	if err := db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending}).Error; err != nil {
		t.Fatal(err)
	}
	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/status/"+strconv.FormatUint(uint64(bob.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(bob.ID), 10)}}
	GetFollowStatusHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var resp FollowStatusResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Outgoing != models.FollowStatusPending {
		t.Fatalf("outgoing=%q", resp.Outgoing)
	}
	if resp.Incoming != "none" {
		t.Fatalf("incoming=%q", resp.Incoming)
	}
}

func TestBlockUser_RemovesFollowBothDirections(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	if err := db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Follow{RequesterID: bob.ID, TargetID: alice.ID, Status: models.FollowStatusPending}).Error; err != nil {
		t.Fatal(err)
	}
	w, c := withUserContext(t, db, alice, http.MethodPost, "/api/blocks/"+strconv.FormatUint(uint64(bob.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(bob.ID), 10)}}
	BlockUserHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
	var cnt int64
	db.Model(&models.Follow{}).Count(&cnt)
	if cnt != 0 {
		t.Fatalf("follow rows after block=%d", cnt)
	}
}

func TestBlockUser_Idempotent(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	if err := db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID}).Error; err != nil {
		t.Fatal(err)
	}
	w, c := withUserContext(t, db, alice, http.MethodPost, "/api/blocks/"+strconv.FormatUint(uint64(bob.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(bob.ID), 10)}}
	BlockUserHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
}

func TestUnblockUser_RemovesBlockOnly(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	if err := db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID}).Error; err != nil {
		t.Fatal(err)
	}
	w, c := withUserContext(t, db, alice, http.MethodDelete, "/api/blocks/"+strconv.FormatUint(uint64(bob.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(bob.ID), 10)}}
	UnblockUserHandler(c)
	if w.Body.Len() > 0 {
		t.Fatalf("unexpected body status=%d body=%s", w.Code, w.Body.String())
	}
	var cnt int64
	db.Model(&models.Block{}).Count(&cnt)
	if cnt != 0 {
		t.Fatalf("blocks=%d", cnt)
	}
	// unblock does not restore follow
	db.Model(&models.Follow{}).Count(&cnt)
	if cnt != 0 {
		t.Fatalf("unexpected follow restored")
	}
}

func TestFollowCounts_OnlyAccepted(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	carol := seedFollowUser(t, db, "carol")
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Follow{RequesterID: carol.ID, TargetID: alice.ID, Status: models.FollowStatusPending})

	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/counts", nil)
	c.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowCountsHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var resp FollowCountsResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Following != 1 || resp.Followers != 0 {
		t.Fatalf("following=%d followers=%d", resp.Following, resp.Followers)
	}
}

func TestFollowersList_ExcludesDeletedUser(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	deleted := models.Korisnik{Username: "gone", Password: "x", Role: "deleted", FullName: "Gone"}
	if err := db.Create(&deleted).Error; err != nil {
		t.Fatal(err)
	}
	_ = db.Create(&models.Follow{RequesterID: deleted.ID, TargetID: alice.ID, Status: models.FollowStatusAccepted})

	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/followers", nil)
	c.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowersListHandler(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	users, _ := body["users"].([]any)
	if len(users) != 0 {
		t.Fatalf("expected deleted user filtered out, got %d", len(users))
	}
}

func TestGetFollowStatus_NeutralWhenBlocked(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	f := models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted}
	if err := db.Create(&f).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID}).Error; err != nil {
		t.Fatal(err)
	}

	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/status/"+strconv.FormatUint(uint64(bob.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(bob.ID), 10)}}
	GetFollowStatusHandler(c)
	var resp FollowStatusResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Outgoing != "none" || resp.Incoming != "none" {
		t.Fatalf("blocked status should be neutral: outgoing=%q incoming=%q", resp.Outgoing, resp.Incoming)
	}
	if resp.OutgoingFollowID != nil || resp.IncomingFollowID != nil {
		t.Fatalf("blocked status leaked follow IDs: %+v", resp)
	}
}

func TestGetFollowStatus_NeutralWhenStaleFollowAndBlock(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusPending})
	_ = db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID})

	w, c := withUserContext(t, db, bob, http.MethodGet, "/api/follows/status/"+strconv.FormatUint(uint64(alice.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(alice.ID), 10)}}
	GetFollowStatusHandler(c)
	var resp FollowStatusResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Outgoing != "none" || resp.Incoming != "none" {
		t.Fatalf("stale pending+block: outgoing=%q incoming=%q", resp.Outgoing, resp.Incoming)
	}
}

func TestFollowersList_ExcludesBlockedPeer(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	carol := seedFollowUser(t, db, "carol")
	_ = db.Create(&models.Follow{RequesterID: bob.ID, TargetID: alice.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Follow{RequesterID: carol.ID, TargetID: alice.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID})

	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/followers", nil)
	c.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowersListHandler(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	users, _ := body["users"].([]any)
	if len(users) != 1 {
		t.Fatalf("expected 1 visible follower, got %d", len(users))
	}
}

func TestFollowersList_ViewerCBlockHidesBOnAList(t *testing.T) {
	db := testFollowBlockDB(t)
	a := seedFollowUser(t, db, "profile_a")
	b := seedFollowUser(t, db, "follower_b")
	c := seedFollowUser(t, db, "viewer_c")
	_ = db.Create(&models.Follow{RequesterID: b.ID, TargetID: a.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Block{BlockerID: c.ID, BlockedID: b.ID})

	w, cxt := withUserContext(t, db, c, http.MethodGet, "/api/follows/user/profile_a/followers", nil)
	cxt.Params = gin.Params{{Key: "id", Value: "profile_a"}}
	GetFollowersListHandler(cxt)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	users, _ := body["users"].([]any)
	if len(users) != 0 {
		t.Fatalf("viewer C should not see blocked B on A followers, got %d", len(users))
	}
}

func TestFollowingList_ExcludesBlockedPeer(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	carol := seedFollowUser(t, db, "carol")
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: carol.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID})

	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/following", nil)
	c.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowingListHandler(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	users, _ := body["users"].([]any)
	if len(users) != 1 {
		t.Fatalf("expected 1 visible following, got %d", len(users))
	}
}

func TestFollowCounts_ExcludesBlockedAndDeleted(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	carol := seedFollowUser(t, db, "carol")
	deleted := models.Korisnik{Username: "gone", Password: "x", Role: "deleted"}
	_ = db.Create(&deleted)
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: carol.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: deleted.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID})

	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/counts", nil)
	c.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowCountsHandler(c)
	var resp FollowCountsResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Following != 1 {
		t.Fatalf("following=%d want 1 (only carol visible)", resp.Following)
	}
}

func TestFollowCounts_MatchesVisibleListLength(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	carol := seedFollowUser(t, db, "carol")
	_ = db.Create(&models.Follow{RequesterID: bob.ID, TargetID: alice.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Follow{RequesterID: carol.ID, TargetID: alice.ID, Status: models.FollowStatusAccepted})
	_ = db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID})

	wCounts, cCounts := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/counts", nil)
	cCounts.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowCountsHandler(cCounts)
	var counts FollowCountsResponse
	_ = json.Unmarshal(wCounts.Body.Bytes(), &counts)

	wList, cList := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/followers", nil)
	cList.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowersListHandler(cList)
	var listBody map[string]any
	_ = json.Unmarshal(wList.Body.Bytes(), &listBody)
	users, _ := listBody["users"].([]any)

	if counts.Followers != int64(len(users)) {
		t.Fatalf("count=%d list=%d", counts.Followers, len(users))
	}
}

func TestStaleBlockAndFollow_ReadEndpointsHideRelation(t *testing.T) {
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "alice")
	bob := seedFollowUser(t, db, "bob")
	_ = db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID})
	_ = db.Create(&models.Follow{RequesterID: alice.ID, TargetID: bob.ID, Status: models.FollowStatusAccepted})

	w, c := withUserContext(t, db, alice, http.MethodGet, "/api/follows/status/"+strconv.FormatUint(uint64(bob.ID), 10), nil)
	c.Params = gin.Params{{Key: "targetId", Value: strconv.FormatUint(uint64(bob.ID), 10)}}
	GetFollowStatusHandler(c)
	var resp FollowStatusResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Outgoing != "none" {
		t.Fatalf("stale follow hidden: outgoing=%q", resp.Outgoing)
	}

	w2, c2 := withUserContext(t, db, alice, http.MethodGet, "/api/follows/user/alice/following", nil)
	c2.Params = gin.Params{{Key: "id", Value: "alice"}}
	GetFollowingListHandler(c2)
	var body map[string]any
	_ = json.Unmarshal(w2.Body.Bytes(), &body)
	users, _ := body["users"].([]any)
	for _, u := range users {
		m, _ := u.(map[string]any)
		if m["username"] == "bob" {
			t.Fatal("blocked bob should not appear in following list")
		}
	}
}
