package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func callCancelSignupCapture(t *testing.T, db *gorm.DB, akcijaID uint, username string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/signup-requests/moj", nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	CancelMojActionSignupRequest(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func TestCancelSignup_Pending_SetsCancelled(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_c1")
	requester := seedRespondRequester(t, db, "req_c1")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[1]", "[]", "[]")

	order := registerLockOrderProbe(t, db)
	code, body := callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	got := reloadSignupRequest(t, db, req.ID)
	if got.Status != models.ActionSignupRequestCancelled {
		t.Fatalf("status=%s", got.Status)
	}
	if got.RespondedAt == nil {
		t.Fatal("RespondedAt")
	}
	if got.ReviewedByID != nil {
		t.Fatal("ReviewedByID must stay nil")
	}
	if got.SelectedSmestajIDs != "[1]" {
		t.Fatal("choices must remain")
	}
	firstAkcija, firstSignup := -1, -1
	for i, table := range *order {
		if table == "akcije" && firstAkcija < 0 {
			firstAkcija = i
		}
		if table == "action_signup_requests" && firstSignup < 0 {
			firstSignup = i
		}
	}
	if firstAkcija < 0 || firstSignup < 0 || firstAkcija > firstSignup {
		t.Fatalf("lock order=%v", *order)
	}
}

func TestCancelSignup_OtherUsersRequest_NoMutation(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_c2")
	owner := seedRespondRequester(t, db, "req_c2")
	other := seedRespondRequester(t, db, "oth_c2")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, owner.ID, "[]", "[]", "[]")

	code, body := callCancelSignupCapture(t, db, akcija.ID, other.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if body["error"] != errCancelSignupNotActive.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("must stay pending")
	}
}

func TestCancelSignup_NoPendingRequest(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_c3")
	requester := seedRespondRequester(t, db, "req_c3")
	akcija := seedRespondAkcija(t, db, vodic)

	code, body := callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if body["error"] != errCancelSignupNotActive.Error() {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestCancelSignup_ActionMissingAfterPreliminary_NoMutation(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_c4")
	requester := seedRespondRequester(t, db, "req_c4")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	if err := db.Delete(&models.Akcija{}, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	code, _ := callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	if code != http.StatusNotFound && code != http.StatusBadRequest {
		t.Fatalf("status=%d", code)
	}
	got := reloadSignupRequest(t, db, req.ID)
	if got.Status != models.ActionSignupRequestPending {
		t.Fatal("must stay pending")
	}
	if got.RespondedAt != nil {
		t.Fatal("RespondedAt must stay nil")
	}
}

func TestCancelSignup_AkcijaIDMismatchAfterLock_NoMutation(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_c5")
	requester := seedRespondRequester(t, db, "req_c5")
	a1 := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.Naziv = "C5a" })
	a2 := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.Naziv = "C5b" })
	req := seedPendingSignup(t, db, a1.ID, requester.ID, "[]", "[]", "[]")

	// Simulacija mismatcha nakon locka: zaključamo a2, a request pripada a1.
	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := helpers.LockAkcijaForUpdate(tx, a2.ID)
		if err != nil {
			return err
		}
		lockedReq, err := helpers.LockActionSignupRequestForUpdate(tx, req.ID)
		if err != nil {
			return err
		}
		if lockedReq.AkcijaID == locked.ID {
			t.Fatal("expected mismatch setup")
		}
		if lockedReq.AkcijaID != locked.ID || lockedReq.AkcijaID != a2.ID {
			return errCancelSignupNotActive
		}
		return nil
	})
	if !errors.Is(err, errCancelSignupNotActive) {
		t.Fatalf("expected not-active, got %v", err)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("must stay pending")
	}
}

func TestCancelSignup_TerminalStatuses_Rejected(t *testing.T) {
	cases := []struct {
		name   string
		status string
		setup  func(t *testing.T, db *gorm.DB, akcijaID, userID uint) models.ActionSignupRequest
	}{
		{
			name:   "accepted",
			status: models.ActionSignupRequestAccepted,
			setup: func(t *testing.T, db *gorm.DB, akcijaID, userID uint) models.ActionSignupRequest {
				t.Helper()
				req := seedPendingSignup(t, db, akcijaID, userID, "[]", "[]", "[]")
				if err := db.Create(&models.Prijava{AkcijaID: akcijaID, KorisnikID: userID, Status: "prijavljen"}).Error; err != nil {
					t.Fatal(err)
				}
				if err := db.Model(&req).Update("status", models.ActionSignupRequestAccepted).Error; err != nil {
					t.Fatal(err)
				}
				return req
			},
		},
		{
			name:   "rejected",
			status: models.ActionSignupRequestRejected,
			setup: func(t *testing.T, db *gorm.DB, akcijaID, userID uint) models.ActionSignupRequest {
				t.Helper()
				req := seedPendingSignup(t, db, akcijaID, userID, "[]", "[]", "[]")
				if err := db.Model(&req).Update("status", models.ActionSignupRequestRejected).Error; err != nil {
					t.Fatal(err)
				}
				return req
			},
		},
		{
			name:   "cancelled",
			status: models.ActionSignupRequestCancelled,
			setup: func(t *testing.T, db *gorm.DB, akcijaID, userID uint) models.ActionSignupRequest {
				t.Helper()
				req := seedPendingSignup(t, db, akcijaID, userID, "[]", "[]", "[]")
				now := time.Now()
				if err := db.Model(&req).Updates(map[string]any{
					"status": models.ActionSignupRequestCancelled, "responded_at": now,
				}).Error; err != nil {
					t.Fatal(err)
				}
				return req
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := testRespondSignupDB(t)
			vodic := seedRespondApprover(t, db, "vod_term_"+tc.name)
			requester := seedRespondRequester(t, db, "req_term_"+tc.name)
			akcija := seedRespondAkcija(t, db, vodic)
			req := tc.setup(t, db, akcija.ID, requester.ID)

			code, body := callCancelSignupCapture(t, db, akcija.ID, requester.Username)
			if code != http.StatusBadRequest {
				t.Fatalf("status=%d body=%v", code, body)
			}
			got := reloadSignupRequest(t, db, req.ID)
			if got.Status != tc.status {
				t.Fatalf("status changed to %s", got.Status)
			}
			if tc.status == models.ActionSignupRequestAccepted {
				if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 1 {
					t.Fatal("prijava must remain")
				}
			}
		})
	}
}

func TestCancelSignup_CompletedAction_StillAllowed(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_ccomp")
	requester := seedRespondRequester(t, db, "req_ccomp")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.IsCompleted = true })
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, body := callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("cancelled")
	}
}

func TestCancelSignup_ParallelWithAccept(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_ca")
	requester := seedRespondRequester(t, db, "req_ca")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	var wg sync.WaitGroup
	var cancelCode, acceptCode int
	wg.Add(2)
	go func() {
		defer wg.Done()
		cancelCode, _ = callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	}()
	go func() {
		defer wg.Done()
		acceptCode, _ = callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	}()
	wg.Wait()

	st := reloadSignupRequest(t, db, req.ID).Status
	switch st {
	case models.ActionSignupRequestCancelled:
		if cancelCode != http.StatusOK {
			t.Fatalf("cancel winner code=%d", cancelCode)
		}
		if acceptCode != http.StatusConflict {
			t.Fatalf("accept loser code=%d", acceptCode)
		}
		if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 0 {
			t.Fatal("no prijava when cancelled wins")
		}
	case models.ActionSignupRequestAccepted:
		if acceptCode != http.StatusOK {
			t.Fatalf("accept winner code=%d", acceptCode)
		}
		if cancelCode != http.StatusBadRequest {
			t.Fatalf("cancel loser code=%d", cancelCode)
		}
		if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 1 {
			t.Fatal("exactly one prijava")
		}
	default:
		t.Fatalf("unexpected status %s cancel=%d accept=%d", st, cancelCode, acceptCode)
	}
}

func TestCancelSignup_ParallelWithReject(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cr")
	requester := seedRespondRequester(t, db, "req_cr")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	var wg sync.WaitGroup
	var cancelCode, rejectCode int
	wg.Add(2)
	go func() {
		defer wg.Done()
		cancelCode, _ = callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	}()
	go func() {
		defer wg.Done()
		rejectCode, _ = callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject")
	}()
	wg.Wait()

	st := reloadSignupRequest(t, db, req.ID).Status
	okCancel := cancelCode == http.StatusOK
	okReject := rejectCode == http.StatusOK
	if okCancel == okReject {
		t.Fatalf("expected exactly one success: cancel=%d reject=%d status=%s", cancelCode, rejectCode, st)
	}
	if st != models.ActionSignupRequestCancelled && st != models.ActionSignupRequestRejected {
		t.Fatalf("status=%s", st)
	}
}

func TestCancelSignup_ParallelCancels_OneWins(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cc")
	requester := seedRespondRequester(t, db, "req_cc")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callCancelSignupCapture(t, db, akcija.ID, requester.Username)
		}(i)
	}
	wg.Wait()

	ok, bad := 0, 0
	for _, c := range codes {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusBadRequest:
			bad++
		default:
			t.Fatalf("unexpected codes=%v", codes)
		}
	}
	if ok != 1 || bad != 1 {
		t.Fatalf("expected 1 ok + 1 bad request, codes=%v", codes)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("cancelled")
	}
}

func TestCancelSignup_WithFinish_BothOrders(t *testing.T) {
	t.Run("cancel_then_finish", func(t *testing.T) {
		db := testRespondSignupDB(t)
		vodic := seedRespondApprover(t, db, "vod_cf")
		requester := seedRespondRequester(t, db, "req_cf")
		akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })
		req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
		if code, _ := callCancelSignupCapture(t, db, akcija.ID, requester.Username); code != http.StatusOK {
			t.Fatal(code)
		}
		if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
			t.Fatalf("finish: %v", err)
		}
		if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
			t.Fatal("cancelled")
		}
		var a models.Akcija
		if err := db.First(&a, akcija.ID).Error; err != nil || !a.IsCompleted {
			t.Fatal("completed")
		}
	})
	t.Run("finish_then_cancel", func(t *testing.T) {
		db := testRespondSignupDB(t)
		vodic := seedRespondApprover(t, db, "vod_fc")
		requester := seedRespondRequester(t, db, "req_fc")
		akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })
		req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
		if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
			t.Fatalf("finish: %v", err)
		}
		if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
			t.Fatal("finish cancels pending")
		}
		if code, _ := callCancelSignupCapture(t, db, akcija.ID, requester.Username); code != http.StatusBadRequest {
			t.Fatalf("cancel after finish expected bad request, got %d", code)
		}
		if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
			t.Fatal("stays cancelled")
		}
	})
}

func TestCancelSignup_WithDelete_HardDeleteGuard(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cd")
	requester := seedRespondRequester(t, db, "req_cd")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	if code, _ := callCancelSignupCapture(t, db, akcija.ID, requester.Username); code != http.StatusOK {
		t.Fatal(code)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("cancelled history remains")
	}
	code, body := callDeleteAkcija(t, db, akcija.ID, vodic.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("delete status=%d body=%v", code, body)
	}
	var n int64
	if err := db.Model(&models.Akcija{}).Where("id = ?", akcija.ID).Count(&n).Error; err != nil || n != 1 {
		t.Fatal("akcija must remain")
	}
}

func TestCancelSignup_UpdateError_RollsBack(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_rb")
	requester := seedRespondRequester(t, db, "req_rb")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	cbName := "fail_cancel_signup_save_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_signup_requests" {
			_ = tx.AddError(errors.New("forced signup update failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, body := callCancelSignupCapture(t, db, akcija.ID, requester.Username)
	if code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%v", code, body)
	}
	got := reloadSignupRequest(t, db, req.ID)
	if got.Status != models.ActionSignupRequestPending {
		t.Fatalf("status=%s", got.Status)
	}
	if got.RespondedAt != nil {
		t.Fatal("RespondedAt must stay nil after rollback")
	}
}

func TestCancelSignup_AfterCancel_NewPendingAllowed(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_np")
	requester := seedRespondRequester(t, db, "req_np")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	if code, _ := callCancelSignupCapture(t, db, akcija.ID, requester.Username); code != http.StatusOK {
		t.Fatal(code)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("cancelled")
	}
	code, body := callPrijaviNaAkciju(t, db, akcija.ID, requester.Username)
	if code != http.StatusOK {
		t.Fatalf("new pending status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("expected one new pending")
	}
}

func TestCancelSignup_NoNotification(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_nn")
	requester := seedRespondRequester(t, db, "req_nn")
	akcija := seedRespondAkcija(t, db, vodic)
	_ = seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	if code, _ := callCancelSignupCapture(t, db, akcija.ID, requester.Username); code != http.StatusOK {
		t.Fatal(code)
	}
	if countSignupNotifs(t, db, requester.ID) != 0 {
		t.Fatal("cancel must not notify")
	}
	if countSignupNotifs(t, db, vodic.ID) != 0 {
		t.Fatal("cancel must not notify approver")
	}
}
