package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func callPublicSubroute(t *testing.T, db *gorm.DB, handler gin.HandlerFunc, param string, viewer *models.Korisnik) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/korisnici/"+param+"/sub", nil)
	c.Set("db", db)
	c.Params = gin.Params{{Key: "id", Value: param}}
	if viewer != nil {
		c.Set(middleware.ContextKeyKorisnik, *viewer)
	}
	handler(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func TestPublicSubroutes_BlockGap_Documented(t *testing.T) {
	db := testPublicProfileDB(t)
	alice := models.Korisnik{Username: "sub_alice", Password: "x", Role: "clan", FullName: "Alice"}
	bob := models.Korisnik{Username: "sub_bob", Password: "x", Role: "clan", FullName: "Bob"}
	if err := db.Create(&alice).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&bob).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID}).Error; err != nil {
		t.Fatal(err)
	}

	// Main profile is blocked (404)
	mainCode, _, _ := callGetPublicKorisnik(t, db, "sub_alice", &bob)
	if mainCode != http.StatusNotFound {
		t.Fatalf("main profile must be 404 when blocked, got %d", mainCode)
	}

	cases := []struct {
		name    string
		handler gin.HandlerFunc
	}{
		{"statistika", GetPublicKorisnikStatistika},
		{"popeo-se", GetPublicKorisnikPopeoSe},
		{"vodio", GetPublicKorisnikVodio},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, body := callPublicSubroute(t, db, tc.handler, "sub_alice", &bob)
			// M2-SUBROUTE-1: sub-routes lack block check — document actual behavior
			if code == http.StatusOK {
				t.Fatalf("M2-SUBROUTE-1 P2: %s returns 200 when main profile is 404 for blocked viewer; body keys=%v", tc.name, keysOf(body))
			}
			if code != http.StatusNotFound {
				t.Fatalf("unexpected status %d for %s", code, tc.name)
			}
		})
	}
}

func TestPublicSubroutes_DeletedUser404(t *testing.T) {
	db := testPublicProfileDB(t)
	deleted := models.Korisnik{Username: "sub_gone", Password: "x", Role: "deleted"}
	if err := db.Create(&deleted).Error; err != nil {
		t.Fatal(err)
	}

	handlers := []struct {
		name string
		fn   gin.HandlerFunc
	}{
		{"main", GetPublicKorisnik},
		{"statistika", GetPublicKorisnikStatistika},
		{"popeo-se", GetPublicKorisnikPopeoSe},
		{"vodio", GetPublicKorisnikVodio},
	}

	for _, h := range handlers {
		t.Run(h.name, func(t *testing.T) {
			var code int
			if h.name == "main" {
				code, _, _ = callGetPublicKorisnik(t, db, "sub_gone", nil)
			} else {
				code, _ = callPublicSubroute(t, db, h.fn, "sub_gone", nil)
			}
			if code != http.StatusNotFound {
				t.Fatalf("%s deleted user status %d", h.name, code)
			}
		})
	}
}

func TestPublicSubroutes_LoggedOutBlockIgnored(t *testing.T) {
	db := testPublicProfileDB(t)
	alice := models.Korisnik{Username: "sub_lo_alice", Password: "x", Role: "clan"}
	bob := models.Korisnik{Username: "sub_lo_bob", Password: "x", Role: "clan"}
	_ = db.Create(&alice)
	_ = db.Create(&bob)
	_ = db.Create(&models.Block{BlockerID: bob.ID, BlockedID: alice.ID})

	code, body, _ := callGetPublicKorisnik(t, db, "sub_lo_alice", nil)
	if code != http.StatusOK {
		t.Fatalf("logged-out must see profile, status %d", code)
	}
	if body["username"] != "sub_lo_alice" {
		t.Fatalf("username=%v", body["username"])
	}
}

func keysOf(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func TestFollowList_NoServerPagination_Documented(t *testing.T) {
	db := testFollowBlockDB(t)
	viewer := seedFollowUser(t, db, "pag_viewer")
	target := seedFollowUser(t, db, "pag_target")
	for i := 0; i < 5; i++ {
		u := seedFollowUser(t, db, "pag_f"+strconv.Itoa(i))
		_ = db.Create(&models.Follow{RequesterID: u.ID, TargetID: target.ID, Status: models.FollowStatusAccepted})
	}

	w, c := withUserContext(t, db, viewer, http.MethodGet, "/followers", nil)
	c.Params = gin.Params{{Key: "id", Value: "pag_target"}}
	GetFollowersListHandler(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	users, _ := body["users"].([]any)
	// Handler has no limit/offset — full filtered list returned (pagination N/A).
	if len(users) != 5 {
		t.Fatalf("expected 5 visible followers without pagination, got %d", len(users))
	}
}

func TestFollowNotification_RequestBestEffort_FollowPersists(t *testing.T) {
	// Without obavestenja table, notification fails but follow is created (M2-NOTIF-1 P3)
	db := testFollowBlockDB(t)
	alice := seedFollowUser(t, db, "notif_alice")
	bob := seedFollowUser(t, db, "notif_bob")
	body, _ := json.Marshal(CreateFollowRequest{TargetID: bob.ID})
	w, c := withUserContext(t, db, alice, http.MethodPost, "/api/follows/requests", body)
	CreateFollowRequestHandler(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("status %d", w.Code)
	}
	if countFollowRows(t, db, alice.ID, bob.ID) != 1 {
		t.Fatal("follow must exist even when notification table missing")
	}
}