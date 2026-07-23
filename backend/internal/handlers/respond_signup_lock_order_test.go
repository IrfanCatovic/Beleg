package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testRespondSignupDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionSignupRequest{},
		&models.AkcijaSmestaj{},
		&models.AkcijaPrevoz{},
		&models.AkcijaOpremaRent{},
		&models.Obavestenje{},
		&models.Transakcija{},
		&models.ActionInviteLink{},
		&models.ActionParticipationRequest{},
		&models.GuideActionRating{},
		&models.AkcijaOprema{},
		&models.FerrataGuideBookingRequest{},
		&models.FerrataGuideBookingTarget{},
		&models.PeakGuideBookingRequest{},
		&models.PeakGuideBookingTarget{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func seedRespondApprover(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "vodic"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedRespondRequester(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedRespondAkcija(t *testing.T, db *gorm.DB, vodic models.Korisnik, opts ...func(*models.Akcija)) models.Akcija {
	t.Helper()
	a := models.Akcija{
		Naziv: "Signup respond", Datum: time.Now().Add(72 * time.Hour),
		MaxLjudi: 10, Javna: true, VodicID: vodic.ID, AddedByID: vodic.ID,
		OrganizatorTip: "vodic",
	}
	for _, opt := range opts {
		opt(&a)
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func seedPendingSignup(t *testing.T, db *gorm.DB, akcijaID, requesterID uint, smestaj, prevoz, rent string) models.ActionSignupRequest {
	t.Helper()
	if smestaj == "" {
		smestaj = "[]"
	}
	if prevoz == "" {
		prevoz = "[]"
	}
	if rent == "" {
		rent = "[]"
	}
	req := models.ActionSignupRequest{
		AkcijaID: akcijaID, RequesterID: requesterID,
		Status: models.ActionSignupRequestPending,
		SelectedSmestajIDs: smestaj, SelectedPrevozIDs: prevoz, SelectedRentItemsRaw: rent,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}
	return req
}

func callRespondSignup(t *testing.T, db *gorm.DB, akcijaID, requestID uint, reviewer models.Korisnik, action string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]string{"action": action})
	path := "/akcije/" + strconv.FormatUint(uint64(akcijaID), 10) +
		"/signup-requests/" + strconv.FormatUint(uint64(requestID), 10) + "/respond"
	c.Request = httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
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

func reloadSignupRequest(t *testing.T, db *gorm.DB, id uint) models.ActionSignupRequest {
	t.Helper()
	var req models.ActionSignupRequest
	if err := db.First(&req, id).Error; err != nil {
		t.Fatal(err)
	}
	return req
}

func countPrijaveForUser(t *testing.T, db *gorm.DB, akcijaID, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, userID).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func countIzboriForUser(t *testing.T, db *gorm.DB, akcijaID, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.PrijavaIzbori{}).
		Joins("JOIN prijave ON prijave.id = prijava_izbori.prijava_id").
		Where("prijave.akcija_id = ? AND prijave.korisnik_id = ?", akcijaID, userID).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func countSignupNotifs(t *testing.T, db *gorm.DB, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Obavestenje{}).
		Where("user_id = ? AND type = ?", userID, models.ObavestenjeTipActionSignupRequest).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func registerLockOrderProbe(t *testing.T, db *gorm.DB) *[]string {
	t.Helper()
	order := &[]string{}
	var mu sync.Mutex
	cbName := "respond_lock_order_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(gdb *gorm.DB) {
		if gdb.Statement == nil {
			return
		}
		if _, ok := gdb.Statement.Clauses["FOR"]; !ok {
			return
		}
		table := gdb.Statement.Table
		if table == "" && gdb.Statement.Schema != nil {
			table = gdb.Statement.Schema.Table
		}
		mu.Lock()
		*order = append(*order, table)
		mu.Unlock()
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })
	return order
}

func TestRespondSignup_Accept_LockOrderAndCreatesPrijava(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_acc")
	requester := seedRespondRequester(t, db, "req_acc")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	order := registerLockOrderProbe(t, db)
	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	got := reloadSignupRequest(t, db, req.ID)
	if got.Status != models.ActionSignupRequestAccepted {
		t.Fatalf("status=%s", got.Status)
	}
	if got.ReviewedByID == nil || *got.ReviewedByID != vodic.ID {
		t.Fatal("ReviewedByID")
	}
	if got.RespondedAt == nil {
		t.Fatal("RespondedAt")
	}
	if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 1 {
		t.Fatal("expected prijava")
	}
	if countIzboriForUser(t, db, akcija.ID, requester.ID) != 1 {
		t.Fatal("expected izbori")
	}

	// Autoritativni lockovi: Akcija pa ActionSignupRequest (može biti više FOR UPDATE na akciji/prijavama u create pathu).
	firstAkcija, firstSignup := -1, -1
	for i, table := range *order {
		switch table {
		case "akcije":
			if firstAkcija < 0 {
				firstAkcija = i
			}
		case "action_signup_requests":
			if firstSignup < 0 {
				firstSignup = i
			}
		}
	}
	if firstAkcija < 0 || firstSignup < 0 {
		t.Fatalf("missing locks in order=%v", *order)
	}
	if firstAkcija > firstSignup {
		t.Fatalf("Akcija must lock before SignupRequest, order=%v", *order)
	}
}

func TestRespondSignup_Reject_LockOrderNoPrijava(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_rej")
	requester := seedRespondRequester(t, db, "req_rej")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	order := registerLockOrderProbe(t, db)
	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	got := reloadSignupRequest(t, db, req.ID)
	if got.Status != models.ActionSignupRequestRejected {
		t.Fatalf("status=%s", got.Status)
	}
	if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 0 {
		t.Fatal("reject must not create prijava")
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
		t.Fatalf("bad lock order=%v", *order)
	}
}

func TestRespondSignup_RequestNotFound(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_nf")
	akcija := seedRespondAkcija(t, db, vodic)
	code, body := callRespondSignup(t, db, akcija.ID, 99999, vodic, "accept")
	if code != http.StatusNotFound {
		t.Fatalf("status=%d body=%v", code, body)
	}
}

func TestRespondSignup_ActionMissingAfterPreliminary_NoMutation(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_miss")
	requester := seedRespondRequester(t, db, "req_miss")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	if err := db.Delete(&models.Akcija{}, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusNotFound {
		t.Fatalf("status=%d body=%v", code, body)
	}
	got := reloadSignupRequest(t, db, req.ID)
	if got.Status != models.ActionSignupRequestPending {
		t.Fatalf("must stay pending, got %s", got.Status)
	}
}

func TestRespondSignup_PathAkcijaMismatch(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_mis")
	requester := seedRespondRequester(t, db, "req_mis")
	a1 := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.Naziv = "A1" })
	a2 := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.Naziv = "A2" })
	req := seedPendingSignup(t, db, a1.ID, requester.ID, "[]", "[]", "[]")

	code, body := callRespondSignup(t, db, a2.ID, req.ID, vodic, "accept")
	if code != http.StatusNotFound {
		t.Fatalf("status=%d body=%v", code, body)
	}
	got := reloadSignupRequest(t, db, req.ID)
	if got.Status != models.ActionSignupRequestPending {
		t.Fatal("must stay pending")
	}
}

func TestRespondSignup_AlreadyAcceptedRejectedCancelled(t *testing.T) {
	cases := []string{
		models.ActionSignupRequestAccepted,
		models.ActionSignupRequestRejected,
		models.ActionSignupRequestCancelled,
	}
	for _, st := range cases {
		t.Run(st, func(t *testing.T) {
			db := testRespondSignupDB(t)
			vodic := seedRespondApprover(t, db, "vod_"+st)
			requester := seedRespondRequester(t, db, "req_"+st)
			akcija := seedRespondAkcija(t, db, vodic)
			req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
			if err := db.Model(&req).Update("status", st).Error; err != nil {
				t.Fatal(err)
			}
			code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
			if code != http.StatusConflict {
				t.Fatalf("status=%d body=%v", code, body)
			}
			if reloadSignupRequest(t, db, req.ID).Status != st {
				t.Fatal("status must not change")
			}
		})
	}
}

func TestRespondSignup_AcceptCompleted_StaysPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_done")
	requester := seedRespondRequester(t, db, "req_done")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.IsCompleted = true })
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("must stay pending")
	}
	if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 0 {
		t.Fatal("no prijava")
	}
}

func TestRespondSignup_RejectCompleted_Allowed(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_done_rej")
	requester := seedRespondRequester(t, db, "req_done_rej")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.IsCompleted = true })
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestRejected {
		t.Fatal("expected rejected")
	}
}

func TestRespondSignup_AcceptCapacity_StaysPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cap")
	requester := seedRespondRequester(t, db, "req_cap")
	filler := seedRespondRequester(t, db, "fill_cap")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.MaxLjudi = 1 })
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: filler.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d", code)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("must stay pending")
	}
	if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 0 {
		t.Fatal("no prijava for requester")
	}
}

func TestRespondSignup_AcceptInvalidChoices_StaysPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_inv")
	requester := seedRespondRequester(t, db, "req_inv")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[99991]", "[]", "[]")

	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusInternalServerError && code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestPending {
		t.Fatal("must stay pending")
	}
	if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 0 {
		t.Fatal("no prijava")
	}
	if countIzboriForUser(t, db, akcija.ID, requester.ID) != 0 {
		t.Fatal("no izbori")
	}
}

func TestRespondSignup_ParallelAccepts_OneWins(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_par")
	requester := seedRespondRequester(t, db, "req_par")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
		}(i)
	}
	wg.Wait()

	ok, conflict := 0, 0
	for _, c := range codes {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
			conflict++
		default:
			t.Fatalf("unexpected codes=%v", codes)
		}
	}
	if ok != 1 || conflict != 1 {
		t.Fatalf("expected 1 ok + 1 conflict, codes=%v", codes)
	}
	if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 1 {
		t.Fatal("exactly one prijava")
	}
	if countIzboriForUser(t, db, akcija.ID, requester.ID) != 1 {
		t.Fatal("exactly one izbori")
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestAccepted {
		t.Fatal("accepted")
	}
	if countSignupNotifs(t, db, requester.ID) != 1 {
		t.Fatalf("one accepted notification, got %d", countSignupNotifs(t, db, requester.ID))
	}
}

func TestRespondSignup_ParallelAcceptReject_OneTerminal(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_ar")
	requester := seedRespondRequester(t, db, "req_ar")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], _ = callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	}()
	go func() {
		defer wg.Done()
		codes[1], _ = callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject")
	}()
	wg.Wait()

	ok, conflict := 0, 0
	for _, c := range codes {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
			conflict++
		default:
			t.Fatalf("unexpected codes=%v", codes)
		}
	}
	if ok != 1 || conflict != 1 {
		t.Fatalf("expected 1 ok + 1 conflict, codes=%v", codes)
	}
	st := reloadSignupRequest(t, db, req.ID).Status
	switch st {
	case models.ActionSignupRequestAccepted:
		if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 1 {
			t.Fatal("accepted must have prijava")
		}
	case models.ActionSignupRequestRejected:
		if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 0 {
			t.Fatal("rejected must not have prijava")
		}
	default:
		t.Fatalf("unexpected terminal status %s", st)
	}
	if countSignupNotifs(t, db, requester.ID) != 1 {
		t.Fatalf("exactly one response notification, got %d", countSignupNotifs(t, db, requester.ID))
	}
}

func TestRespondSignup_AcceptThenFinish_BlockedByParticipant(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_af")
	requester := seedRespondRequester(t, db, "req_af")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusOK {
		t.Fatalf("accept status=%d", code)
	}
	_, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaHasUnresolvedParticipants) {
		t.Fatalf("expected unresolved guard, got %v", err)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestAccepted {
		t.Fatal("accepted")
	}
}

func TestRespondSignup_FinishThenAccept_LifecyclePending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_fa")
	requester := seedRespondRequester(t, db, "req_fa")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	// Finish terminalizuje pending → cancelled.
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("finish must cancel pending request")
	}

	code, body := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusConflict {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("accept after finish keeps cancelled")
	}
}

func TestRespondSignup_RejectAndFinish_BothOrders(t *testing.T) {
	t.Run("reject_then_finish", func(t *testing.T) {
		db := testRespondSignupDB(t)
		vodic := seedRespondApprover(t, db, "vod_rf")
		requester := seedRespondRequester(t, db, "req_rf")
		akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })
		req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
		if code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject"); code != http.StatusOK {
			t.Fatalf("reject %d", code)
		}
		if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
			t.Fatalf("finish: %v", err)
		}
		if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestRejected {
			t.Fatal("rejected")
		}
	})
	t.Run("finish_then_reject", func(t *testing.T) {
		db := testRespondSignupDB(t)
		vodic := seedRespondApprover(t, db, "vod_fr")
		requester := seedRespondRequester(t, db, "req_fr")
		akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })
		req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
		if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
			t.Fatalf("finish: %v", err)
		}
		if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
			t.Fatal("finish cancels pending")
		}
		if code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject"); code != http.StatusConflict {
			t.Fatalf("reject after finish expected conflict, got %d", code)
		}
		if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
			t.Fatal("stays cancelled")
		}
	})
}

func TestRespondSignup_RespondAndDelete_Invariants(t *testing.T) {
	t.Run("delete_empty_then_respond_not_found", func(t *testing.T) {
		db := testRespondSignupDB(t)
		vodic := seedRespondApprover(t, db, "vod_del1")
		akcija := seedRespondAkcija(t, db, vodic)
		code, _ := callDeleteAkcija(t, db, akcija.ID, vodic.Username, "vodic")
		if code != http.StatusOK {
			t.Fatalf("delete %d", code)
		}
		code, _ = callRespondSignup(t, db, akcija.ID, 1, vodic, "accept")
		if code != http.StatusNotFound {
			t.Fatalf("respond after delete %d", code)
		}
	})
	t.Run("accept_then_delete_409", func(t *testing.T) {
		db := testRespondSignupDB(t)
		vodic := seedRespondApprover(t, db, "vod_del2")
		requester := seedRespondRequester(t, db, "req_del2")
		akcija := seedRespondAkcija(t, db, vodic)
		req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
		if code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept"); code != http.StatusOK {
			t.Fatal(code)
		}
		code, body := callDeleteAkcija(t, db, akcija.ID, vodic.Username, "vodic")
		if code != http.StatusConflict {
			t.Fatalf("delete status=%d body=%v", code, body)
		}
	})
	t.Run("reject_then_delete_409", func(t *testing.T) {
		db := testRespondSignupDB(t)
		vodic := seedRespondApprover(t, db, "vod_del3")
		requester := seedRespondRequester(t, db, "req_del3")
		akcija := seedRespondAkcija(t, db, vodic)
		req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
		if code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject"); code != http.StatusOK {
			t.Fatal(code)
		}
		code, body := callDeleteAkcija(t, db, akcija.ID, vodic.Username, "vodic")
		if code != http.StatusConflict {
			t.Fatalf("delete status=%d body=%v", code, body)
		}
	})
}

func TestRespondSignup_NotificationOnlyAfterCommit(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_notif")
	requester := seedRespondRequester(t, db, "req_notif")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.IsCompleted = true })
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusBadRequest {
		t.Fatalf("expected lifecycle fail, got %d", code)
	}
	if countSignupNotifs(t, db, requester.ID) != 0 {
		t.Fatal("rollback/lifecycle must not notify")
	}

	akcija.IsCompleted = false
	if err := db.Model(&akcija).Update("is_completed", false).Error; err != nil {
		t.Fatal(err)
	}
	code, _ = callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusOK {
		t.Fatalf("accept %d", code)
	}
	if countSignupNotifs(t, db, requester.ID) != 1 {
		t.Fatal("one notification after commit")
	}
}

func TestRespondSignup_RejectNotifiesAfterCommit(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_rej_n")
	requester := seedRespondRequester(t, db, "req_rej_n")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")
	code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "reject")
	if code != http.StatusOK {
		t.Fatal(code)
	}
	if countSignupNotifs(t, db, requester.ID) != 1 {
		t.Fatal("rejected notification after commit")
	}
}

// Cancel i accept/reject dijele Akcija → SignupRequest lock order; cancel-then-accept
// mora dati conflict bez prijave.
func TestRespondSignup_CancelThenAccept_Conflict(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cancel")
	requester := seedRespondRequester(t, db, "req_cancel")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	if code := callCancelSignup(t, db, akcija.ID, requester.Username); code != http.StatusOK {
		t.Fatalf("cancel %d", code)
	}
	code, _ := callRespondSignup(t, db, akcija.ID, req.ID, vodic, "accept")
	if code != http.StatusConflict {
		t.Fatalf("accept after cancel expected conflict, got %d", code)
	}
	if reloadSignupRequest(t, db, req.ID).Status != models.ActionSignupRequestCancelled {
		t.Fatal("cancelled")
	}
	if countPrijaveForUser(t, db, akcija.ID, requester.ID) != 0 {
		t.Fatal("no prijava")
	}
}

func TestLockActionSignupRequestForUpdate_NotFoundVsOK(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_lock")
	requester := seedRespondRequester(t, db, "req_lock")
	akcija := seedRespondAkcija(t, db, vodic)
	req := seedPendingSignup(t, db, akcija.ID, requester.ID, "[]", "[]", "[]")

	err := db.Transaction(func(tx *gorm.DB) error {
		if _, err := helpers.LockAkcijaForUpdate(tx, akcija.ID); err != nil {
			return err
		}
		locked, err := helpers.LockActionSignupRequestForUpdate(tx, req.ID)
		if err != nil {
			return err
		}
		if locked.ID != req.ID || locked.Status != models.ActionSignupRequestPending {
			t.Fatalf("bad locked request %+v", locked)
		}
		_, err = helpers.LockActionSignupRequestForUpdate(tx, 99999)
		return err
	})
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestCreatePrijavaFromChoicesWithLockedAkcija_NoRelock(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_nolock")
	requester := seedRespondRequester(t, db, "req_nolock")
	akcija := seedRespondAkcija(t, db, vodic)

	var akcijaLocks int
	cbName := "count_akcija_locks_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(gdb *gorm.DB) {
		if gdb.Statement == nil {
			return
		}
		if _, ok := gdb.Statement.Clauses["FOR"]; !ok {
			return
		}
		table := gdb.Statement.Table
		if table == "" && gdb.Statement.Schema != nil {
			table = gdb.Statement.Schema.Table
		}
		if table == "akcije" {
			akcijaLocks++
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })

	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := helpers.LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		_, err = createPrijavaFromChoicesWithLockedAkcija(tx, locked, requester, prijavaChoicesPayload{})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if akcijaLocks != 1 {
		t.Fatalf("expected single Akcija lock, got %d", akcijaLocks)
	}
}
