package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func callGetMojaPrijavaZaAkciju(t *testing.T, db *gorm.DB, akcijaID uint, username string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/moja-prijava", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	GetMojaPrijavaZaAkciju(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func callGetActionSignupRequests(t *testing.T, db *gorm.DB, akcijaID uint, reviewer models.Korisnik) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/signup-requests", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", reviewer.Username)
	c.Set("role", reviewer.Role)
	GetActionSignupRequests(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func TestFinishCleanupAPI_PendingSignupGoneFromReads(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_api_fc")
	user := seedRespondRequester(t, db, "req_api_fc")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) {
		a.VodicID = 0
		a.AddedByID = vodic.ID
	})

	raw, hash, err := helpers.GenerateActionInviteToken()
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionInviteLink{AkcijaID: akcija.ID, TokenHash: hash}).Error; err != nil {
		t.Fatal(err)
	}
	req := seedPendingSignup(t, db, akcija.ID, user.ID, "[]", "[]", "[]")

	if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("cancelled")
	}

	code, body := callGetMojePrijave(t, db, user.Username)
	if code != http.StatusOK {
		t.Fatalf("moje prijave %d", code)
	}
	pendingIDs := uintIDsFromJSON(t, body["pendingSignupAkcije"])
	if pendingIDs[akcija.ID] {
		t.Fatal("finished action must not appear in pendingSignupAkcije")
	}

	code, detail := callGetMojaPrijavaZaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("moja prijava %d", code)
	}
	if detail["signupRequest"] != nil {
		t.Fatalf("signupRequest must be nil, got %v", detail["signupRequest"])
	}

	// Admin default filter = pending
	code, adminBody := callGetActionSignupRequests(t, db, akcija.ID, vodic)
	if code != http.StatusOK {
		t.Fatalf("admin list %d body=%v", code, adminBody)
	}
	reqs, _ := adminBody["requests"].([]any)
	if len(reqs) != 0 {
		t.Fatalf("default pending list must be empty after finish, got %d", len(reqs))
	}

	if hasValidActionInviteLink(db, akcija.ID, raw) {
		t.Fatal("revoked invite must not validate")
	}
}
