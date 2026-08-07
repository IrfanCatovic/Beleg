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

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TestModule4_Block_ApplicantBlockedGuide_ApplyForbidden(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b1")
	guide := m4User(t, db, "m4_g1", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_v1", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: guide.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d %v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no signup on blocked apply")
	}
}

func TestModule4_Block_GuideBlockedApplicant_ApplyForbidden(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b2")
	guide := m4User(t, db, "m4_g2", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_v2", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: guide.ID, BlockedID: viewer.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
}

func TestModule4_Block_ApplicantBlockedCreator_ApplyForbidden(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b3")
	creator := m4User(t, db, "m4_c3", "admin", &club.ID)
	guide := m4User(t, db, "m4_g3", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_v3", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Model(&akcija).Update("added_by_id", creator.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: creator.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
}

func TestModule4_Block_CreatorBlockedApplicant_ApplyForbidden(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b4")
	creator := m4User(t, db, "m4_c4", "admin", &club.ID)
	guide := m4User(t, db, "m4_g4", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_v4", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Model(&akcija).Update("added_by_id", creator.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: creator.ID, BlockedID: viewer.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
}

func TestModule4_Block_IrrelevantUserDoesNotBlock(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b5")
	guide := m4User(t, db, "m4_g5", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_v5", "clan", &club.ID)
	other := m4User(t, db, "m4_d5", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: other.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d %v", code, body)
	}
}

func TestModule4_Block_NoGuideUsesCreatorOnly(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b6")
	creator := m4User(t, db, "m4_c6", "admin", &club.ID)
	viewer := m4User(t, db, "m4_v6", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, creator.ID, true)
	if err := db.Model(&akcija).Updates(map[string]any{"vodic_id": 0, "added_by_id": creator.ID}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: creator.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
}

func TestModule4_Block_ExistingPendingSurvivesLaterBlock(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b7")
	guide := m4User(t, db, "m4_g7", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_v7", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusOK {
		t.Fatalf("apply: %d", code)
	}
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: guide.ID}).Error; err != nil {
		t.Fatal(err)
	}
	var cnt int64
	db.Model(&models.ActionSignupRequest{}).
		Where("akcija_id = ? AND requester_id = ? AND status = ?", akcija.ID, viewer.ID, models.ActionSignupRequestPending).
		Count(&cnt)
	if cnt != 1 {
		t.Fatalf("pending must survive block, got %d", cnt)
	}
}

func TestModule4_Block_ConfirmedCanWithdraw(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b8")
	guide := m4User(t, db, "m4_g8", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_v8", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: viewer.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Block{BlockerID: guide.ID, BlockedID: viewer.ID}).Error; err != nil {
		t.Fatal(err)
	}
	w, c := m4ManageCtx(t, db, viewer, http.MethodDelete, "/api/akcije/"+strconv.FormatUint(uint64(akcija.ID), 10)+"/prijavi", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcija.ID), 10)}}
	OtkaziPrijavuNaAkciju(c)
	if w.Code != http.StatusOK {
		t.Fatalf("withdraw expected 200, got %d %s", w.Code, w.Body.String())
	}
}

func TestModule4_Block_SuperadminApplicantNotExempt(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_b9")
	guide := m4User(t, db, "m4_g9", "vodic", &club.ID)
	sa := m4User(t, db, "m4_sa9", "superadmin", nil)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: sa.ID, BlockedID: guide.ID}).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, sa.Username)
	if code != http.StatusForbidden {
		t.Fatalf("superadmin applicant must still respect block, got %d", code)
	}
}

func TestModule4_Auth_ApproveMatrix(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_auth")
	other := m4Club(t, db, "m4_auth_other")
	creator := m4User(t, db, "m4_creator", "clan", &club.ID)
	guide := m4User(t, db, "m4_guide_a", "vodic", &club.ID)
	hostAdmin := m4User(t, db, "m4_host_admin", "admin", &club.ID)
	hostSec := m4User(t, db, "m4_host_sec", "sekretar", &club.ID)
	otherAdmin := m4User(t, db, "m4_other_admin", "admin", &other.ID)
	otherSec := m4User(t, db, "m4_other_sec", "sekretar", &other.ID)
	participant := m4User(t, db, "m4_part", "clan", &club.ID)
	outsider := m4User(t, db, "m4_out", "clan", &other.ID)
	superadmin := m4User(t, db, "m4_sa", "superadmin", nil)

	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Model(&akcija).Update("added_by_id", creator.ID).Error; err != nil {
		t.Fatal(err)
	}
	_ = db.First(&akcija, akcija.ID)

	cases := []struct {
		name    string
		actor   models.Korisnik
		allow   bool
		xClubID string
	}{
		{"creator", creator, true, ""},
		{"guide", guide, true, ""},
		{"hostAdmin", hostAdmin, true, ""},
		{"hostSecretary", hostSec, false, ""},
		{"superadmin", superadmin, true, strconv.FormatUint(uint64(club.ID), 10)},
		{"participant", participant, false, ""},
		{"outsider", outsider, false, ""},
		{"otherAdmin", otherAdmin, false, ""},
		{"otherSecretary", otherSec, false, ""},
	}

	for i, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			reqUser := m4User(t, db, "m4_req_"+tc.name+"_"+strconv.Itoa(i), "clan", &club.ID)
			req := models.ActionSignupRequest{
				AkcijaID: akcija.ID, RequesterID: reqUser.ID,
				Status:               models.ActionSignupRequestPending,
				SelectedSmestajIDs:   "[]",
				SelectedPrevozIDs:    "[]",
				SelectedRentItemsRaw: "[]",
			}
			if err := db.Create(&req).Error; err != nil {
				t.Fatal(err)
			}
			code, body := callRespondSignupWithClub(t, db, akcija.ID, req.ID, tc.actor, "accept", tc.xClubID)
			if tc.allow && code != http.StatusOK {
				t.Fatalf("expected allow 200, got %d %v", code, body)
			}
			if !tc.allow && code != http.StatusForbidden {
				t.Fatalf("expected deny 403, got %d %v", code, body)
			}
		})
	}
}

func TestModule4_Auth_CancelledAndCompletedDeny(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_life")
	guide := m4User(t, db, "m4_gl", "vodic", &club.ID)
	requester := m4User(t, db, "m4_rl", "clan", &club.ID)

	cancelled := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&cancelled).Update("is_cancelled", true)
	req1 := models.ActionSignupRequest{
		AkcijaID: cancelled.ID, RequesterID: requester.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	_ = db.Create(&req1)
	code, _ := callRespondSignup(t, db, cancelled.ID, req1.ID, guide, "accept")
	if code < 400 {
		t.Fatalf("cancelled must deny, got %d", code)
	}

	completed := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&completed).Update("is_completed", true)
	req2 := models.ActionSignupRequest{
		AkcijaID: completed.ID, RequesterID: requester.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	_ = db.Create(&req2)
	code, _ = callRespondSignup(t, db, completed.ID, req2.ID, guide, "accept")
	if code < 400 {
		t.Fatalf("completed must deny, got %d", code)
	}
}

func TestModule4_Auth_DuplicateApproveControlled(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_dup")
	guide := m4User(t, db, "m4_gd", "vodic", &club.ID)
	requester := m4User(t, db, "m4_rd", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	req := models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: requester.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	_ = db.Create(&req)
	code1, _ := callRespondSignup(t, db, akcija.ID, req.ID, guide, "accept")
	if code1 != http.StatusOK {
		t.Fatalf("first accept: %d", code1)
	}
	code2, body := callRespondSignup(t, db, akcija.ID, req.ID, guide, "accept")
	if code2 != http.StatusConflict {
		t.Fatalf("duplicate expect 409, got %d %v", code2, body)
	}
	var notifCnt int64
	db.Model(&models.Obavestenje{}).Where("user_id = ?", requester.ID).Count(&notifCnt)
	if notifCnt != 1 {
		t.Fatalf("one notification on transition, got %d", notifCnt)
	}
}

func TestModule4_LastSlot_ParallelApprove_OneWins(t *testing.T) {
	// MaxOpenConns(1) kao ostali signup parallel testovi: SQLite serializacija konekcija,
	// a i dalje pokriva last-slot capacity (jedan OK, jedan controlled 4xx).
	db := testModule4DB(t)

	club := m4Club(t, db, "m4_race")
	guide := m4User(t, db, "m4_gr", "vodic", &club.ID)
	a1 := m4User(t, db, "m4_a1", "clan", &club.ID)
	a2 := m4User(t, db, "m4_a2", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&akcija).Update("max_ljudi", 1)

	r1 := models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: a1.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	r2 := models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: a2.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	_ = db.Create(&r1)
	_ = db.Create(&r2)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], _ = callRespondSignup(t, db, akcija.ID, r1.ID, guide, "accept")
	}()
	go func() {
		defer wg.Done()
		codes[1], _ = callRespondSignup(t, db, akcija.ID, r2.ID, guide, "accept")
	}()
	wg.Wait()

	ok, controlled := 0, 0
	for _, c := range codes {
		if c == http.StatusOK {
			ok++
		} else if c >= 400 && c < 500 {
			controlled++
		} else {
			t.Fatalf("unexpected codes=%v", codes)
		}
	}
	if ok != 1 || controlled != 1 {
		t.Fatalf("expected 1 ok + 1 controlled error, codes=%v", codes)
	}
	var prijavaCnt int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND status <> ?", akcija.ID, "otkazano").Count(&prijavaCnt)
	if prijavaCnt != 1 {
		t.Fatalf("accepted count must be 1, got %d", prijavaCnt)
	}
}

func TestModule4_SummitNotify_PostCommitOnlyOnTransition(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_sum")
	guide := m4User(t, db, "m4_gs", "vodic", &club.ID)
	member := m4User(t, db, "m4_ms", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&akcija).Updates(map[string]any{
		"is_completed":               true,
		"ukupno_km_akcija":           10.0,
		"ukupno_metara_uspona_akcija": 500.0,
	})
	prijava := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	_ = db.Create(&prijava)

	body, _ := json.Marshal(map[string]string{"status": "popeo se"})
	w, c := m4ManageCtx(t, db, guide, http.MethodPut, "/api/prijave/"+strconv.FormatUint(uint64(prijava.ID), 10)+"/status", body)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijava.ID), 10)}}
	UpdatePrijavaStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status update: %d %s", w.Code, w.Body.String())
	}
	var n1 int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND type = ?", member.ID, "summit_reward").Count(&n1)
	if n1 != 1 {
		t.Fatalf("expected 1 summit notification, got %d", n1)
	}

	body2, _ := json.Marshal(map[string]string{"status": "popeo se"})
	w2, c2 := m4ManageCtx(t, db, guide, http.MethodPut, "/api/prijave/"+strconv.FormatUint(uint64(prijava.ID), 10)+"/status", body2)
	c2.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijava.ID), 10)}}
	UpdatePrijavaStatus(c2)
	if w2.Code != http.StatusOK {
		t.Fatalf("duplicate status: %d", w2.Code)
	}
	var n2 int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND type = ?", member.ID, "summit_reward").Count(&n2)
	if n2 != 1 {
		t.Fatalf("duplicate popeo se must not notify again, got %d", n2)
	}

	// Documented contract: nije uspeo → popeo se sends another notification (real transition).
	body3, _ := json.Marshal(map[string]string{"status": "nije uspeo"})
	w3, c3 := m4ManageCtx(t, db, guide, http.MethodPut, "/api/prijave/"+strconv.FormatUint(uint64(prijava.ID), 10)+"/status", body3)
	c3.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijava.ID), 10)}}
	UpdatePrijavaStatus(c3)
	if w3.Code != http.StatusOK {
		t.Fatalf("to nije uspeo: %d", w3.Code)
	}
	body4, _ := json.Marshal(map[string]string{"status": "popeo se"})
	w4, c4 := m4ManageCtx(t, db, guide, http.MethodPut, "/api/prijave/"+strconv.FormatUint(uint64(prijava.ID), 10)+"/status", body4)
	c4.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijava.ID), 10)}}
	UpdatePrijavaStatus(c4)
	if w4.Code != http.StatusOK {
		t.Fatalf("re-popeo se: %d", w4.Code)
	}
	var n3 int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND type = ?", member.ID, "summit_reward").Count(&n3)
	if n3 != 2 {
		t.Fatalf("documented: re-transition to popeo se sends new notification, got %d", n3)
	}
}

func TestModule4_Block_NoNotificationOnBlockedApply(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_bn")
	guide := m4User(t, db, "m4_gn", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_vn", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: guide.ID}).Error; err != nil {
		t.Fatal(err)
	}
	before := countObavestenja(t, db)
	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, viewer.Username)
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
	if countObavestenja(t, db) != before {
		t.Fatal("blocked apply must not create notifications")
	}
}

func TestModule4_Block_ListDetailStillVisible(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_vis")
	guide := m4User(t, db, "m4_gvis", "vodic", &club.ID)
	viewer := m4User(t, db, "m4_vvis", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	if err := db.Create(&models.Block{BlockerID: viewer.ID, BlockedID: guide.ID}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callGetPublicAkcijaByID(t, db, akcija.ID)
	if code != http.StatusOK {
		t.Fatalf("detail must stay visible under block, got %d %v", code, body)
	}
	if body["id"] == nil {
		t.Fatalf("expected action id in detail, body=%v", body)
	}

	// List includes public club actions regardless of block with guide.
	w, c := m4ManageCtx(t, db, viewer, http.MethodGet, "/api/akcije", nil)
	GetAkcije(c)
	if w.Code != http.StatusOK {
		t.Fatalf("list must stay available under block, got %d %s", w.Code, w.Body.String())
	}
}

func TestModule4_Auth_RejectMatrix_CreatorAndGuide(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_rej")
	creator := m4User(t, db, "m4_crej", "clan", &club.ID)
	guide := m4User(t, db, "m4_grej", "vodic", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&akcija).Update("added_by_id", creator.ID)

	for i, actor := range []models.Korisnik{creator, guide} {
		reqUser := m4User(t, db, "m4_rrej_"+strconv.Itoa(i), "clan", &club.ID)
		req := models.ActionSignupRequest{
			AkcijaID: akcija.ID, RequesterID: reqUser.ID, Status: models.ActionSignupRequestPending,
			SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}
		_ = db.Create(&req)
		code, _ := callRespondSignup(t, db, akcija.ID, req.ID, actor, "reject")
		if code != http.StatusOK {
			t.Fatalf("%s reject expected 200, got %d", actor.Username, code)
		}
	}
}

func TestModule4_Auth_ActorCannotBeSpoofedViaBody(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_spoof")
	guide := m4User(t, db, "m4_gspoof", "vodic", &club.ID)
	outsider := m4User(t, db, "m4_ospoof", "clan", &club.ID)
	requester := m4User(t, db, "m4_rspoof", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	req := models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: requester.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	_ = db.Create(&req)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]any{
		"action":     "accept",
		"reviewedBy": guide.ID,
		"actorId":    guide.ID,
		"userId":     guide.ID,
	})
	path := "/akcije/" + strconv.FormatUint(uint64(akcija.ID), 10) +
		"/signup-requests/" + strconv.FormatUint(uint64(req.ID), 10) + "/respond"
	c.Request = httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{
		{Key: "id", Value: strconv.FormatUint(uint64(akcija.ID), 10)},
		{Key: "requestId", Value: strconv.FormatUint(uint64(req.ID), 10)},
	}
	c.Set("db", db)
	c.Set("username", outsider.Username)
	c.Set("role", outsider.Role)
	RespondToActionSignupRequest(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("spoofed body must not authorize outsider, got %d %s", w.Code, w.Body.String())
	}
}

func TestModule4_WithdrawApprove_ParallelLinearized(t *testing.T) {
	// MaxOpenConns(1) kao TestCancelSignup_ParallelWithAccept — SQLite-safe serializacija.
	db := testModule4DB(t)

	club := m4Club(t, db, "m4_wa")
	guide := m4User(t, db, "m4_gwa", "vodic", &club.ID)
	requester := m4User(t, db, "m4_rwa", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	req := models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: requester.ID, Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}
	_ = db.Create(&req)

	var wg sync.WaitGroup
	var cancelCode, acceptCode int
	wg.Add(2)
	go func() {
		defer wg.Done()
		cancelCode, _ = callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	}()
	go func() {
		defer wg.Done()
		acceptCode, _ = callRespondSignup(t, db, akcija.ID, req.ID, guide, "accept")
	}()
	wg.Wait()

	got := reloadSignupRequest(t, db, req.ID)
	var prijavaCnt int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, requester.ID).Count(&prijavaCnt)

	switch got.Status {
	case models.ActionSignupRequestAccepted:
		if acceptCode != http.StatusOK {
			t.Fatalf("accepted but acceptCode=%d cancel=%d", acceptCode, cancelCode)
		}
		if prijavaCnt != 1 {
			t.Fatalf("accepted must have Prijava, got %d", prijavaCnt)
		}
		if cancelCode == http.StatusOK {
			t.Fatal("cannot have both cancel OK and accepted")
		}
	case models.ActionSignupRequestCancelled:
		if cancelCode != http.StatusOK {
			t.Fatalf("cancelled but cancelCode=%d accept=%d", cancelCode, acceptCode)
		}
		if prijavaCnt != 0 {
			t.Fatalf("cancelled must not leave active Prijava, got %d", prijavaCnt)
		}
		if acceptCode == http.StatusOK {
			t.Fatal("cannot have both accept OK and cancelled")
		}
	default:
		t.Fatalf("expected accepted or cancelled, got %s codes cancel=%d accept=%d", got.Status, cancelCode, acceptCode)
	}
	if acceptCode >= 500 || cancelCode >= 500 {
		t.Fatalf("no 500 allowed: cancel=%d accept=%d", cancelCode, acceptCode)
	}
}

func TestModule4_SummitNotify_NijeUspeoNoNotify(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_nu")
	guide := m4User(t, db, "m4_gnu", "vodic", &club.ID)
	member := m4User(t, db, "m4_mnu", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&akcija).Updates(map[string]any{
		"is_completed": true, "ukupno_km_akcija": 10.0, "ukupno_metara_uspona_akcija": 500.0,
	})
	prijava := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	_ = db.Create(&prijava)

	body, _ := json.Marshal(map[string]string{"status": "nije uspeo"})
	w, c := m4ManageCtx(t, db, guide, http.MethodPut, "/api/prijave/"+strconv.FormatUint(uint64(prijava.ID), 10)+"/status", body)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijava.ID), 10)}}
	UpdatePrijavaStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status: %d", w.Code)
	}
	var n int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND type = ?", member.ID, "summit_reward").Count(&n)
	if n != 0 {
		t.Fatalf("nije uspeo must not notify, got %d", n)
	}
}

func TestModule4_SummitNotify_CancelledActionNoNotify(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_sc")
	guide := m4User(t, db, "m4_gsc", "vodic", &club.ID)
	member := m4User(t, db, "m4_msc", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&akcija).Updates(map[string]any{
		"is_completed": true, "is_cancelled": true,
		"ukupno_km_akcija": 10.0, "ukupno_metara_uspona_akcija": 500.0,
	})
	prijava := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	_ = db.Create(&prijava)

	body, _ := json.Marshal(map[string]string{"status": "popeo se"})
	w, c := m4ManageCtx(t, db, guide, http.MethodPut, "/api/prijave/"+strconv.FormatUint(uint64(prijava.ID), 10)+"/status", body)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijava.ID), 10)}}
	UpdatePrijavaStatus(c)
	if w.Code < 400 {
		t.Fatalf("cancelled action must deny status update, got %d", w.Code)
	}
	var n int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND type = ?", member.ID, "summit_reward").Count(&n)
	if n != 0 {
		t.Fatalf("cancelled must not notify, got %d", n)
	}
}

func TestModule4_SummitNotify_UnauthorizedNoNotify(t *testing.T) {
	db := testModule4DB(t)
	club := m4Club(t, db, "m4_su")
	guide := m4User(t, db, "m4_gsu", "vodic", &club.ID)
	member := m4User(t, db, "m4_msu", "clan", &club.ID)
	outsider := m4User(t, db, "m4_osu", "clan", &club.ID)
	akcija := m4Akcija(t, db, club.ID, guide.ID, true)
	_ = db.Model(&akcija).Updates(map[string]any{
		"is_completed": true, "ukupno_km_akcija": 10.0, "ukupno_metara_uspona_akcija": 500.0,
	})
	prijava := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	_ = db.Create(&prijava)

	body, _ := json.Marshal(map[string]string{"status": "popeo se"})
	w, c := m4ManageCtx(t, db, outsider, http.MethodPut, "/api/prijave/"+strconv.FormatUint(uint64(prijava.ID), 10)+"/status", body)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(prijava.ID), 10)}}
	UpdatePrijavaStatus(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
	var n int64
	db.Model(&models.Obavestenje{}).Where("user_id = ? AND type = ?", member.ID, "summit_reward").Count(&n)
	if n != 0 {
		t.Fatalf("unauthorized must not notify, got %d", n)
	}
	var got models.Prijava
	_ = db.First(&got, prijava.ID)
	if got.Status != "prijavljen" {
		t.Fatalf("status must stay prijavljen, got %s", got.Status)
	}
}

func callRespondSignupWithClub(
	t *testing.T,
	db *gorm.DB,
	akcijaID, requestID uint,
	reviewer models.Korisnik,
	action string,
	xClubID string,
) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]string{"action": action})
	path := "/akcije/" + strconv.FormatUint(uint64(akcijaID), 10) +
		"/signup-requests/" + strconv.FormatUint(uint64(requestID), 10) + "/respond"
	c.Request = httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	if xClubID != "" {
		c.Request.Header.Set("X-Club-Id", xClubID)
	}
	c.Params = gin.Params{
		{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)},
		{Key: "requestId", Value: strconv.FormatUint(uint64(requestID), 10)},
	}
	c.Set("db", db)
	c.Set("username", reviewer.Username)
	c.Set("role", reviewer.Role)
	RespondToActionSignupRequest(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func countObavestenja(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var n int64
	db.Model(&models.Obavestenje{}).Count(&n)
	return n
}
