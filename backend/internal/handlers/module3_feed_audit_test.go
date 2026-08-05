package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPostsDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "module3_posts")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Klubovi{},
		&models.Korisnik{},
		&models.Follow{},
		&models.Block{},
		&models.Post{},
		&models.PostLike{},
		&models.PostComment{},
		&models.Obavestenje{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedClub(t *testing.T, db *gorm.DB, name string) models.Klubovi {
	t.Helper()
	k := models.Klubovi{Naziv: name}
	if err := db.Create(&k).Error; err != nil {
		t.Fatal(err)
	}
	return k
}

func seedPostUser(t *testing.T, db *gorm.DB, username string, clubID *uint) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan", FullName: username, KlubID: clubID}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func withPostUserContext(t *testing.T, db *gorm.DB, user models.Korisnik, method, path string, body []byte) (*httptest.ResponseRecorder, *gin.Context) {
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
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	return w, c
}

func seedPost(t *testing.T, db *gorm.DB, author models.Korisnik, clubID uint, content string) models.Post {
	t.Helper()
	p := models.Post{
		ClubID:   clubID,
		UserID:   author.ID,
		AuthorID: author.ID,
		Content:  content,
	}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func callGetPosts(t *testing.T, db *gorm.DB, viewer models.Korisnik, query string) (int, map[string]any) {
	t.Helper()
	path := "/api/posts"
	if query != "" {
		path += "?" + query
	}
	w, c := withPostUserContext(t, db, viewer, http.MethodGet, path, nil)
	if query != "" {
		c.Request.URL.RawQuery = query
	}
	GetPosts(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func callGetPost(t *testing.T, db *gorm.DB, viewer models.Korisnik, postID uint) (int, map[string]any) {
	t.Helper()
	id := strconv.FormatUint(uint64(postID), 10)
	w, c := withPostUserContext(t, db, viewer, http.MethodGet, "/api/posts/"+id, nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	GetPost(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func postIDsFromFeed(body map[string]any) []uint {
	raw, _ := body["posts"].([]any)
	out := make([]uint, 0, len(raw))
	for _, item := range raw {
		m, _ := item.(map[string]any)
		if m == nil {
			continue
		}
		id, _ := m["id"].(float64)
		out = append(out, uint(id))
	}
	return out
}

func containsPostID(ids []uint, want uint) bool {
	for _, id := range ids {
		if id == want {
			return true
		}
	}
	return false
}

func TestModule3_GetPost_BlockEitherDirection_404(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "club_block")
	alice := seedPostUser(t, db, "m3_alice", &club.ID)
	bob := seedPostUser(t, db, "m3_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "secret")

	_ = db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID})
	code, body := callGetPost(t, db, bob, post.ID)
	if code != http.StatusNotFound {
		t.Fatalf("blocked viewer must get 404, got %d body=%v", code, body)
	}

	_ = db.Where("1=1").Delete(&models.Block{})
	_ = db.Create(&models.Block{BlockerID: alice.ID, BlockedID: bob.ID})
	code2, _ := callGetPost(t, db, bob, post.ID)
	if code2 != http.StatusNotFound {
		t.Fatalf("reverse block must get 404, got %d", code2)
	}
}

func TestModule3_GetPost_OutsideAllowList_404(t *testing.T) {
	db := testPostsDB(t)
	clubA := seedClub(t, db, "club_a")
	clubB := seedClub(t, db, "club_b")
	alice := seedPostUser(t, db, "out_alice", &clubA.ID)
	outsider := seedPostUser(t, db, "out_stranger", &clubB.ID)
	post := seedPost(t, db, alice, clubA.ID, "private club post")

	code, _ := callGetPost(t, db, outsider, post.ID)
	if code != http.StatusNotFound {
		t.Fatalf("outsider must get 404, got %d", code)
	}
}

func TestModule3_FeedList_BlockParity_Documented(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "club_feed_block")
	alice := seedPostUser(t, db, "fb_alice", &club.ID)
	bob := seedPostUser(t, db, "fb_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "still in feed?")
	_ = db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID})

	singleCode, _ := callGetPost(t, db, bob, post.ID)
	if singleCode != http.StatusNotFound {
		t.Fatalf("single post must be 404 when blocked, got %d", singleCode)
	}

	listCode, listBody := callGetPosts(t, db, bob, "limit=50&offset=0")
	if listCode != http.StatusOK {
		t.Fatalf("feed list status %d", listCode)
	}
	ids := postIDsFromFeed(listBody)
	if containsPostID(ids, post.ID) {
		t.Fatalf("M3-FEED-BLOCK-1 P2: feed list returns blocked author post id=%d while GET /posts/:id is 404; ids=%v", post.ID, ids)
	}
}

func TestModule3_FeedList_ClubmateVisible_NoBlock(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "club_ok")
	alice := seedPostUser(t, db, "ok_alice", &club.ID)
	bob := seedPostUser(t, db, "ok_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "hello")

	code, body := callGetPosts(t, db, bob, "")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if !containsPostID(postIDsFromFeed(body), post.ID) {
		t.Fatalf("clubmate post must appear in feed")
	}
	single, _ := callGetPost(t, db, bob, post.ID)
	if single != http.StatusOK {
		t.Fatalf("single must be 200, got %d", single)
	}
}

func TestModule3_FeedList_AcceptedFollowVisible(t *testing.T) {
	db := testPostsDB(t)
	clubA := seedClub(t, db, "fa")
	clubB := seedClub(t, db, "fb")
	alice := seedPostUser(t, db, "fl_alice", &clubA.ID)
	bob := seedPostUser(t, db, "fl_bob", &clubB.ID)
	post := seedPost(t, db, alice, clubA.ID, "cross")
	_ = db.Create(&models.Follow{RequesterID: bob.ID, TargetID: alice.ID, Status: models.FollowStatusAccepted})

	code, body := callGetPosts(t, db, bob, "")
	if code != http.StatusOK || !containsPostID(postIDsFromFeed(body), post.ID) {
		t.Fatalf("accepted follow target post must be in feed, code=%d body=%v", code, body)
	}
}

func TestModule3_FeedPagination_OrderingDesc(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "club_page")
	alice := seedPostUser(t, db, "pg_alice", &club.ID)
	now := time.Now().UTC()
	p1 := models.Post{ClubID: club.ID, UserID: alice.ID, AuthorID: alice.ID, Content: "first", CreatedAt: now.Add(-2 * time.Hour)}
	p2 := models.Post{ClubID: club.ID, UserID: alice.ID, AuthorID: alice.ID, Content: "second", CreatedAt: now.Add(-1 * time.Hour)}
	p3 := models.Post{ClubID: club.ID, UserID: alice.ID, AuthorID: alice.ID, Content: "third", CreatedAt: now}
	for _, p := range []*models.Post{&p1, &p2, &p3} {
		if err := db.Create(p).Error; err != nil {
			t.Fatal(err)
		}
	}

	code, body := callGetPosts(t, db, alice, "limit=2&offset=0")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	ids := postIDsFromFeed(body)
	if len(ids) != 2 {
		t.Fatalf("limit=2 got %d posts", len(ids))
	}
	if ids[0] != p3.ID || ids[1] != p2.ID {
		t.Fatalf("expected newest-first [%d %d], got %v", p3.ID, p2.ID, ids)
	}
	total, _ := body["total"].(float64)
	if int(total) < 3 {
		t.Fatalf("total=%v want >=3", body["total"])
	}

	_, page2 := callGetPosts(t, db, alice, "limit=2&offset=2")
	ids2 := postIDsFromFeed(page2)
	if len(ids2) != 1 || ids2[0] != p1.ID {
		t.Fatalf("page2 expected [%d], got %v", p1.ID, ids2)
	}
}

func TestModule3_Comments_BypassFeedVisibility_Documented(t *testing.T) {
	db := testPostsDB(t)
	clubA := seedClub(t, db, "cvis_a")
	clubB := seedClub(t, db, "cvis_b")
	alice := seedPostUser(t, db, "cvis_alice", &clubA.ID)
	outsider := seedPostUser(t, db, "cvis_out", &clubB.ID)
	post := seedPost(t, db, alice, clubA.ID, "private")
	_ = db.Create(&models.PostComment{PostID: post.ID, UserID: alice.ID, Content: "internal note"})

	single, _ := callGetPost(t, db, outsider, post.ID)
	if single != http.StatusNotFound {
		t.Fatalf("GetPost must 404 for outsider, got %d", single)
	}

	id := strconv.FormatUint(uint64(post.ID), 10)
	w, c := withPostUserContext(t, db, outsider, http.MethodGet, "/api/posts/"+id+"/comments", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	GetPostComments(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	comments, _ := body["comments"].([]any)
	if w.Code == http.StatusOK && len(comments) > 0 {
		t.Fatalf("M3-ENGAGE-1 P1: outsider reads comments on inaccessible post; GetPost=404 but comments=%d status=%d", len(comments), w.Code)
	}
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for inaccessible post comments, got %d", w.Code)
	}
}

func TestModule3_CommentCreate_BypassFeedVisibility_Documented(t *testing.T) {
	db := testPostsDB(t)
	clubA := seedClub(t, db, "cc_a")
	clubB := seedClub(t, db, "cc_b")
	alice := seedPostUser(t, db, "cc_alice", &clubA.ID)
	outsider := seedPostUser(t, db, "cc_out", &clubB.ID)
	post := seedPost(t, db, alice, clubA.ID, "private")

	body, _ := json.Marshal(CreateCommentRequest{Content: "intrusion"})
	id := strconv.FormatUint(uint64(post.ID), 10)
	w, c := withPostUserContext(t, db, outsider, http.MethodPost, "/api/posts/"+id+"/comments", body)
	c.Params = gin.Params{{Key: "id", Value: id}}
	CreatePostComment(c)

	var cnt int64
	db.Model(&models.PostComment{}).Where("post_id = ? AND user_id = ?", post.ID, outsider.ID).Count(&cnt)
	if w.Code == http.StatusCreated || cnt > 0 {
		t.Fatalf("M3-ENGAGE-2 P1: outsider created comment on inaccessible post status=%d cnt=%d", w.Code, cnt)
	}
}

func TestModule3_Like_BypassFeedVisibility_Documented(t *testing.T) {
	db := testPostsDB(t)
	clubA := seedClub(t, db, "lk_a")
	clubB := seedClub(t, db, "lk_b")
	alice := seedPostUser(t, db, "lk_alice", &clubA.ID)
	outsider := seedPostUser(t, db, "lk_out", &clubB.ID)
	post := seedPost(t, db, alice, clubA.ID, "private")

	id := strconv.FormatUint(uint64(post.ID), 10)
	w, c := withPostUserContext(t, db, outsider, http.MethodPost, "/api/posts/"+id+"/like", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	TogglePostLike(c)

	var cnt int64
	db.Model(&models.PostLike{}).Where("post_id = ? AND user_id = ?", post.ID, outsider.ID).Count(&cnt)
	if w.Code == http.StatusOK && cnt > 0 {
		t.Fatalf("M3-ENGAGE-3 P1: outsider liked inaccessible post status=%d liked=%d", w.Code, cnt)
	}
}

func TestModule3_LikeList_BypassFeedVisibility_Documented(t *testing.T) {
	db := testPostsDB(t)
	clubA := seedClub(t, db, "ll_a")
	clubB := seedClub(t, db, "ll_b")
	alice := seedPostUser(t, db, "ll_alice", &clubA.ID)
	bob := seedPostUser(t, db, "ll_bob", &clubA.ID)
	outsider := seedPostUser(t, db, "ll_out", &clubB.ID)
	post := seedPost(t, db, alice, clubA.ID, "private")
	_ = db.Create(&models.PostLike{PostID: post.ID, UserID: bob.ID})

	id := strconv.FormatUint(uint64(post.ID), 10)
	w, c := withPostUserContext(t, db, outsider, http.MethodGet, "/api/posts/"+id+"/likes", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	GetPostLikes(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	likes, _ := body["likes"].([]any)
	if w.Code == http.StatusOK && len(likes) > 0 {
		t.Fatalf("M3-ENGAGE-4 P1: outsider reads likes on inaccessible post; likes=%d", len(likes))
	}
}

func TestModule3_Comments_BlockAuthorPost_Documented(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "cb_club")
	alice := seedPostUser(t, db, "cb_alice", &club.ID)
	bob := seedPostUser(t, db, "cb_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "x")
	_ = db.Create(&models.PostComment{PostID: post.ID, UserID: alice.ID, Content: "hi"})
	_ = db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID})

	single, _ := callGetPost(t, db, bob, post.ID)
	if single != http.StatusNotFound {
		t.Fatalf("GetPost blocked → 404, got %d", single)
	}

	id := strconv.FormatUint(uint64(post.ID), 10)
	w, c := withPostUserContext(t, db, bob, http.MethodGet, "/api/posts/"+id+"/comments", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	GetPostComments(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	comments, _ := body["comments"].([]any)
	if w.Code == http.StatusOK && len(comments) > 0 {
		t.Fatalf("M3-ENGAGE-BLOCK-1 P2: blocked viewer reads comments while GetPost is 404")
	}
}

func TestModule3_GetComments_MissingPost_Documented(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "miss_c")
	viewer := seedPostUser(t, db, "miss_v", &club.ID)

	w, c := withPostUserContext(t, db, viewer, http.MethodGet, "/api/posts/99999/comments", nil)
	c.Params = gin.Params{{Key: "id", Value: "99999"}}
	GetPostComments(c)
	if w.Code == http.StatusOK {
		t.Fatalf("M3-COMMENTS-MISSING-1 P2: GET comments for missing post returned 200 (expected 404)")
	}
}

func TestModule3_CreateUpdateDeletePost_AuthorFlow(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "crud_c")
	alice := seedPostUser(t, db, "crud_alice", &club.ID)

	createBody, _ := json.Marshal(CreatePostRequest{Content: "hello world"})
	w, c := withPostUserContext(t, db, alice, http.MethodPost, "/api/posts", createBody)
	CreatePost(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("create status %d body=%s", w.Code, w.Body.String())
	}
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	postMap, _ := created["post"].(map[string]any)
	postID := uint(postMap["id"].(float64))

	newContent := "edited"
	upd, _ := json.Marshal(UpdatePostRequest{Content: &newContent})
	id := strconv.FormatUint(uint64(postID), 10)
	w2, c2 := withPostUserContext(t, db, alice, http.MethodPatch, "/api/posts/"+id, upd)
	c2.Params = gin.Params{{Key: "id", Value: id}}
	UpdatePost(c2)
	if w2.Code != http.StatusOK {
		t.Fatalf("update status %d", w2.Code)
	}

	w3, c3 := withPostUserContext(t, db, alice, http.MethodDelete, "/api/posts/"+id, nil)
	c3.Params = gin.Params{{Key: "id", Value: id}}
	DeletePost(c3)
	if w3.Code != http.StatusOK {
		t.Fatalf("delete status %d", w3.Code)
	}
	var gone models.Post
	if err := db.First(&gone, postID).Error; err == nil {
		t.Fatal("post must be deleted")
	}
	var likes, comments int64
	db.Model(&models.PostLike{}).Where("post_id = ?", postID).Count(&likes)
	db.Model(&models.PostComment{}).Where("post_id = ?", postID).Count(&comments)
	if likes != 0 || comments != 0 {
		t.Fatalf("orphans likes=%d comments=%d", likes, comments)
	}
}

func TestModule3_UpdatePost_NonAuthorForbidden(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "na_c")
	alice := seedPostUser(t, db, "na_alice", &club.ID)
	bob := seedPostUser(t, db, "na_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "mine")
	content := "hack"
	body, _ := json.Marshal(UpdatePostRequest{Content: &content})
	id := strconv.FormatUint(uint64(post.ID), 10)
	w, c := withPostUserContext(t, db, bob, http.MethodPatch, "/api/posts/"+id, body)
	c.Params = gin.Params{{Key: "id", Value: id}}
	UpdatePost(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status %d", w.Code)
	}
}

func TestModule3_DeleteComment_AuthorCannot_Documented(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "dca")
	alice := seedPostUser(t, db, "dca_alice", &club.ID)
	bob := seedPostUser(t, db, "dca_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "p")
	cm := models.PostComment{PostID: post.ID, UserID: bob.ID, Content: "mine"}
	_ = db.Create(&cm)

	pid := strconv.FormatUint(uint64(post.ID), 10)
	cid := strconv.FormatUint(uint64(cm.ID), 10)
	w, c := withPostUserContext(t, db, bob, http.MethodDelete, "/api/posts/"+pid+"/comments/"+cid, nil)
	c.Params = gin.Params{{Key: "id", Value: pid}, {Key: "commentId", Value: cid}}
	DeletePostComment(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("comment author delete expected 403 by contract, got %d", w.Code)
	}
}

func TestModule3_LikeToggle_IdempotentCounts(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "like_c")
	alice := seedPostUser(t, db, "like_alice", &club.ID)
	bob := seedPostUser(t, db, "like_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "p")
	id := strconv.FormatUint(uint64(post.ID), 10)

	w1, c1 := withPostUserContext(t, db, bob, http.MethodPost, "/api/posts/"+id+"/like", nil)
	c1.Params = gin.Params{{Key: "id", Value: id}}
	TogglePostLike(c1)
	var r1 ToggleLikeResponse
	_ = json.Unmarshal(w1.Body.Bytes(), &r1)
	if !r1.Liked || r1.LikeCount != 1 {
		t.Fatalf("after like: %+v", r1)
	}

	w2, c2 := withPostUserContext(t, db, bob, http.MethodPost, "/api/posts/"+id+"/like", nil)
	c2.Params = gin.Params{{Key: "id", Value: id}}
	TogglePostLike(c2)
	var r2 ToggleLikeResponse
	_ = json.Unmarshal(w2.Body.Bytes(), &r2)
	if r2.Liked || r2.LikeCount != 0 {
		t.Fatalf("after unlike: %+v", r2)
	}
}

func TestModule3_LikeConcurrent_NoDuplicateRows(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "race_like")
	alice := seedPostUser(t, db, "rl_alice", &club.ID)
	bob := seedPostUser(t, db, "rl_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "p")
	id := strconv.FormatUint(uint64(post.ID), 10)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func(idx int) {
			defer wg.Done()
			w, c := withPostUserContext(t, db, bob, http.MethodPost, "/api/posts/"+id+"/like", nil)
			c.Params = gin.Params{{Key: "id", Value: id}}
			TogglePostLike(c)
			codes[idx] = w.Code
		}(i)
	}
	wg.Wait()

	var cnt int64
	db.Model(&models.PostLike{}).Where("post_id = ? AND user_id = ?", post.ID, bob.ID).Count(&cnt)
	if cnt > 1 {
		t.Fatalf("duplicate like rows=%d", cnt)
	}
	for _, code := range codes {
		if code == http.StatusInternalServerError {
			t.Fatalf("M3-LIKE-RACE-1 P2: concurrent like returned 500 codes=%v (unique race leak)", codes)
		}
	}
}

func TestModule3_FeedCounts_MatchAggregates(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "cnt_c")
	alice := seedPostUser(t, db, "cnt_alice", &club.ID)
	bob := seedPostUser(t, db, "cnt_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "p")
	_ = db.Create(&models.PostLike{PostID: post.ID, UserID: bob.ID})
	_ = db.Create(&models.PostComment{PostID: post.ID, UserID: bob.ID, Content: "c1"})
	_ = db.Create(&models.PostComment{PostID: post.ID, UserID: alice.ID, Content: "c2"})

	_, body := callGetPosts(t, db, alice, "")
	for _, item := range body["posts"].([]any) {
		m := item.(map[string]any)
		if uint(m["id"].(float64)) != post.ID {
			continue
		}
		if int(m["likeCount"].(float64)) != 1 {
			t.Fatalf("likeCount=%v", m["likeCount"])
		}
		if int(m["commentCount"].(float64)) != 2 {
			t.Fatalf("commentCount=%v", m["commentCount"])
		}
		return
	}
	t.Fatal("post missing from feed")
}

func TestModule3_DeletedAuthor_StillInFeedAllowList_Documented(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "del_c")
	alice := seedPostUser(t, db, "del_alice", &club.ID)
	bob := seedPostUser(t, db, "del_bob", &club.ID)
	post := seedPost(t, db, alice, club.ID, "ghost")
	_ = db.Model(&alice).Update("role", "deleted")

	code, body := callGetPosts(t, db, bob, "")
	ids := postIDsFromFeed(body)
	if code == http.StatusOK && containsPostID(ids, post.ID) {
		t.Fatalf("M3-DELETED-1 P3: deleted author post still in clubmate feed ids=%v", ids)
	}
}

func TestModule3_CanViewerAccessFeedPost_Unit(t *testing.T) {
	db := testPostsDB(t)
	club := seedClub(t, db, "unit_c")
	alice := seedPostUser(t, db, "unit_a", &club.ID)
	bob := seedPostUser(t, db, "unit_b", &club.ID)
	if !canViewerAccessFeedPost(db, bob, alice.ID) {
		t.Fatal("clubmate should access")
	}
	_ = db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID})
	if canViewerAccessFeedPost(db, bob, alice.ID) {
		t.Fatal("blocked must deny")
	}
}
