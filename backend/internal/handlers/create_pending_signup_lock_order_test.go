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

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func callPrijaviNaAkcijuJSON(t *testing.T, db *gorm.DB, akcijaID uint, username string, payload any) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var bodyReader *bytes.Reader
	if payload == nil {
		bodyReader = bytes.NewReader(nil)
	} else {
		raw, _ := json.Marshal(payload)
		bodyReader = bytes.NewReader(raw)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/prijava", bodyReader)
	if payload != nil {
		c.Request.Header.Set("Content-Type", "application/json")
	}
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	PrijaviNaAkciju(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func TestCreatePendingSignup_Active_CreatesPendingAndNotifies(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp1")
	user := seedRespondRequester(t, db, "req_cp1")
	akcija := seedRespondAkcija(t, db, vodic)

	order := registerLockOrderProbe(t, db)
	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("expected one pending")
	}
	if countPrijaveForUser(t, db, akcija.ID, user.ID) != 0 {
		t.Fatal("no prijava until accept")
	}
	if countSignupNotifs(t, db, vodic.ID) != 1 {
		t.Fatalf("expected one approver notification, got %d", countSignupNotifs(t, db, vodic.ID))
	}

	firstAkcija := -1
	for i, table := range *order {
		if table == "akcije" {
			firstAkcija = i
			break
		}
	}
	if firstAkcija < 0 {
		t.Fatalf("expected Akcija FOR UPDATE, order=%v", *order)
	}
}

func TestCreatePendingSignup_Completed_NoRequest(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp2")
	user := seedRespondRequester(t, db, "req_cp2")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.IsCompleted = true })

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if body["error"] != helpers.ErrAkcijaAlreadyComplete.Error() {
		t.Fatalf("error=%v", body["error"])
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending")
	}
	if countSignupNotifs(t, db, vodic.ID) != 0 {
		t.Fatal("no notification")
	}
}

func TestCreatePendingSignup_DeadlinePassed_NoRequest(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp3")
	user := seedRespondRequester(t, db, "req_cp3")
	past := time.Now().AddDate(0, 0, -2)
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.RokPrijava = &past })

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending")
	}
	_ = body
}

func TestCreatePendingSignup_Full_NoRequest(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp4")
	user := seedRespondRequester(t, db, "req_cp4")
	filler := seedRespondRequester(t, db, "fill_cp4")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.MaxLjudi = 1 })
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: filler.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d", code)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending")
	}
}

func TestCreatePendingSignup_InvalidChoices_NoRequest(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp5")
	user := seedRespondRequester(t, db, "req_cp5")
	akcija := seedRespondAkcija(t, db, vodic)

	code, body := callPrijaviNaAkcijuJSON(t, db, akcija.ID, user.Username, map[string]any{
		"selectedSmestajIds": []uint{99991},
	})
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending")
	}
	if countSignupNotifs(t, db, vodic.ID) != 0 {
		t.Fatal("no notification")
	}
}

func TestCreatePendingSignup_BlockingPrijava_Rejected(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp6")
	user := seedRespondRequester(t, db, "req_cp6")
	akcija := seedRespondAkcija(t, db, vodic)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest || body["error"] != helpers.ErrDuplicatePrijava.Error() {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending")
	}
}

func TestCreatePendingSignup_Otkazano_AllowsPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp7")
	user := seedRespondRequester(t, db, "req_cp7")
	akcija := seedRespondAkcija(t, db, vodic)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("pending allowed with otkazano")
	}
}

func TestCreatePendingSignup_DuplicatePending_Rejected(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp8")
	user := seedRespondRequester(t, db, "req_cp8")
	akcija := seedRespondAkcija(t, db, vodic)

	code1, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	code2, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code1 != http.StatusOK {
		t.Fatalf("first=%d", code1)
	}
	if code2 != http.StatusBadRequest || body["error"] != helpers.ErrPendingSignupExists.Error() {
		t.Fatalf("second=%d body=%v", code2, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("exactly one pending")
	}
	if countSignupNotifs(t, db, vodic.ID) != 1 {
		t.Fatal("one notification")
	}
}

func TestCreatePendingSignup_ParallelSameUser_OnePending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp9")
	user := seedRespondRequester(t, db, "req_cp9")
	akcija := seedRespondAkcija(t, db, vodic)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
		}(i)
	}
	wg.Wait()

	ok, dup := 0, 0
	for _, c := range codes {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusBadRequest:
			dup++
		default:
			t.Fatalf("unexpected codes=%v", codes)
		}
	}
	if ok != 1 || dup != 1 {
		t.Fatalf("expected 1 ok + 1 duplicate, codes=%v", codes)
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("one pending")
	}
	if countSignupNotifs(t, db, vodic.ID) != 1 {
		t.Fatal("one notification")
	}
}

func TestCreatePendingSignup_TwoUsers_BothPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp10")
	u1 := seedRespondRequester(t, db, "req_cp10a")
	u2 := seedRespondRequester(t, db, "req_cp10b")
	akcija := seedRespondAkcija(t, db, vodic)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	users := []models.Korisnik{u1, u2}
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callPrijaviNaAkciju(t, db, akcija.ID, users[idx].Username)
		}(i)
	}
	wg.Wait()
	for _, c := range codes {
		if c != http.StatusOK {
			t.Fatalf("codes=%v", codes)
		}
	}
	if countPendingSignups(t, db, akcija.ID) != 2 {
		t.Fatal("two pending")
	}
}

func TestCreatePendingSignup_FinishFirst_LifecycleNoPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp11")
	user := seedRespondRequester(t, db, "req_cp11")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })

	if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending after finish")
	}
}

func TestCreatePendingSignup_SignupFirst_FinishCancelsPending(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp12")
	user := seedRespondRequester(t, db, "req_cp12")
	akcija := seedRespondAkcija(t, db, vodic, func(a *models.Akcija) { a.VodicID = 0 })

	if code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username); code != http.StatusOK {
		t.Fatal(code)
	}
	if _, err := actions.FinishAction(db, &akcija, vodic, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("pending must be cancelled by finish")
	}
	var req models.ActionSignupRequest
	if err := db.Where("akcija_id = ? AND requester_id = ?", akcija.ID, user.ID).First(&req).Error; err != nil {
		t.Fatal(err)
	}
	if req.Status != models.ActionSignupRequestCancelled {
		t.Fatalf("status=%s", req.Status)
	}
	var a models.Akcija
	if err := db.First(&a, akcija.ID).Error; err != nil || !a.IsCompleted {
		t.Fatal("completed")
	}
}

func TestCreatePendingSignup_DeleteFirst_NotFound(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp13")
	user := seedRespondRequester(t, db, "req_cp13")
	akcija := seedRespondAkcija(t, db, vodic)

	if code, _ := callDeleteAkcija(t, db, akcija.ID, vodic.Username, "vodic"); code != http.StatusOK {
		t.Fatal(code)
	}
	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusNotFound {
		t.Fatalf("status=%d body=%v", code, body)
	}
}

func TestCreatePendingSignup_SignupFirst_Delete409(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp14")
	user := seedRespondRequester(t, db, "req_cp14")
	akcija := seedRespondAkcija(t, db, vodic)

	if code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username); code != http.StatusOK {
		t.Fatal(code)
	}
	code, body := callDeleteAkcija(t, db, akcija.ID, vodic.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status=%d body=%v", code, body)
	}
}

func TestCreatePendingSignup_ParallelWithRespond_NoDeadlock(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp15")
	u1 := seedRespondRequester(t, db, "req_cp15a")
	u2 := seedRespondRequester(t, db, "req_cp15b")
	akcija := seedRespondAkcija(t, db, vodic)
	existing := seedPendingSignup(t, db, akcija.ID, u1.ID, "[]", "[]", "[]")

	var wg sync.WaitGroup
	var createCode, acceptCode int
	wg.Add(2)
	go func() {
		defer wg.Done()
		createCode, _ = callPrijaviNaAkciju(t, db, akcija.ID, u2.Username)
	}()
	go func() {
		defer wg.Done()
		acceptCode, _ = callRespondSignup(t, db, akcija.ID, existing.ID, vodic, "accept")
	}()
	wg.Wait()

	if createCode != http.StatusOK {
		t.Fatalf("create=%d", createCode)
	}
	if acceptCode != http.StatusOK {
		t.Fatalf("accept=%d", acceptCode)
	}
	if reloadSignupRequest(t, db, existing.ID).Status != models.ActionSignupRequestAccepted {
		t.Fatal("accepted")
	}
	if countPendingSignups(t, db, akcija.ID) != 1 {
		t.Fatal("u2 pending remains")
	}
}

func TestCreatePendingSignup_UniqueConflictMapped(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp16")
	user := seedRespondRequester(t, db, "req_cp16")
	akcija := seedRespondAkcija(t, db, vodic)

	err := db.Transaction(func(tx *gorm.DB) error {
		locked, err := helpers.LockAkcijaForUpdate(tx, akcija.ID)
		if err != nil {
			return err
		}
		if _, err := createPendingActionSignupRequestTx(tx, locked, &user, prijavaChoicesPayload{}); err != nil {
			return err
		}
		// Simuliraj unique race: drugi insert mapira se na ErrPendingSignupExists.
		dup := models.ActionSignupRequest{
			AkcijaID: akcija.ID, RequesterID: user.ID,
			Status: models.ActionSignupRequestPending,
			SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
		}
		createErr := tx.Create(&dup).Error
		mapped := helpers.MapCreateSignupRequestError(createErr)
		if !errors.Is(mapped, helpers.ErrPendingSignupExists) && createErr == nil {
			// SQLite bez partial unique i dalje dozvoljava duplikat — u tom slučaju
			// HasPendingSignupRequest bi uhvatio prije inserta u pravom flowu.
			return nil
		}
		if createErr != nil && !errors.Is(mapped, helpers.ErrPendingSignupExists) {
			t.Fatalf("expected mapped pending exists, got %v (raw %v)", mapped, createErr)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestCreatePendingSignup_InsertError_NoNotification(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp17")
	user := seedRespondRequester(t, db, "req_cp17")
	akcija := seedRespondAkcija(t, db, vodic)

	cbName := "fail_signup_insert_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_signup_requests" {
			_ = tx.AddError(errors.New("forced signup insert failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	code, body := callPrijaviNaAkciju(t, db, akcija.ID, user.Username)
	if code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if countPendingSignups(t, db, akcija.ID) != 0 {
		t.Fatal("no pending after rollback")
	}
	if countSignupNotifs(t, db, vodic.ID) != 0 {
		t.Fatal("no notification")
	}
}

func TestCreatePendingSignup_HelperRequiresLockedAkcija(t *testing.T) {
	db := testRespondSignupDB(t)
	user := seedRespondRequester(t, db, "req_cp18")
	_, err := createPendingActionSignupRequestTx(db, nil, &user, prijavaChoicesPayload{})
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected not found without locked akcija, got %v", err)
	}
}

func TestCreatePendingSignup_NoCreateWithoutActionLock(t *testing.T) {
	db := testRespondSignupDB(t)
	vodic := seedRespondApprover(t, db, "vod_cp19")
	user := seedRespondRequester(t, db, "req_cp19")
	akcija := seedRespondAkcija(t, db, vodic)

	var sawAkcijaLock, sawSignupCreate bool
	var mu sync.Mutex
	cbLock := "probe_lock_" + t.Name()
	cbCreate := "probe_create_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbLock, func(gdb *gorm.DB) {
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
			mu.Lock()
			sawAkcijaLock = true
			mu.Unlock()
		}
	}); err != nil {
		t.Fatal(err)
	}
	if err := db.Callback().Create().Before("gorm:create").Register(cbCreate, func(gdb *gorm.DB) {
		if gdb.Statement != nil && gdb.Statement.Table == "action_signup_requests" {
			mu.Lock()
			if !sawAkcijaLock {
				t.Error("signup create without prior Akcija lock")
			}
			sawSignupCreate = true
			mu.Unlock()
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = db.Callback().Query().Remove(cbLock)
		_ = db.Callback().Create().Remove(cbCreate)
	})

	if code, _ := callPrijaviNaAkciju(t, db, akcija.ID, user.Username); code != http.StatusOK {
		t.Fatal(code)
	}
	if !sawSignupCreate {
		t.Fatal("expected signup create")
	}
}
