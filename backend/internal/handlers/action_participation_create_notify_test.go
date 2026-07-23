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
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setParticipationCreateNotifyForTest(t *testing.T, fn func(*gorm.DB, models.ActionParticipationRequest)) {
	t.Helper()
	prev := participationCreateNotify
	participationCreateNotify = fn
	t.Cleanup(func() { participationCreateNotify = prev })
}

func testParticipationCreateDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Klubovi{},
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionParticipationRequest{},
		&models.Obavestenje{},
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

type participationCreateFixture struct {
	db     *gorm.DB
	klubID uint
	admin  models.Korisnik
	target models.Korisnik
	akcija models.Akcija
}

func seedParticipationCreate(t *testing.T, db *gorm.DB, suffix string) participationCreateFixture {
	t.Helper()
	klub := models.Klubovi{Naziv: "Klub " + suffix}
	if err := db.Create(&klub).Error; err != nil {
		t.Fatal(err)
	}
	klubID := klub.ID
	admin := models.Korisnik{
		Username: "adm_c_" + suffix, Password: "x", Role: "vodic", KlubID: &klubID,
	}
	otherKlubID := klubID + 1000
	target := models.Korisnik{
		Username: "tgt_c_" + suffix, Password: "x", Role: "clan", KlubID: &otherKlubID,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&target).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Done " + suffix, Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		UkupnoKmAkcija: 4, UkupnoMetaraUsponaAkcija: 250, KlubID: &klubID,
		VodicID: admin.ID, AddedByID: admin.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	return participationCreateFixture{db: db, klubID: klubID, admin: admin, target: target, akcija: akcija}
}

func callCreateParticipation(t *testing.T, db *gorm.DB, akcijaID uint, admin models.Korisnik, klubID, targetUserID uint) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]any{"targetUserId": targetUserID})
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/ucesce-zahtevi", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", admin.Username)
	c.Set("role", admin.Role)
	c.Set("klubId", klubID)
	c.Set(middleware.ContextKeyKorisnik, admin)
	CreateActionParticipationRequest(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func countParticipationNotifs(t *testing.T, db *gorm.DB, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Obavestenje{}).
		Where("user_id = ? AND type = ?", userID, models.ObavestenjeTipActionParticipationRequest).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func countPendingParticipation(t *testing.T, db *gorm.DB, akcijaID, targetID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.ActionParticipationRequest{}).
		Where("akcija_id = ? AND target_user_id = ? AND status = ?", akcijaID, targetID, models.ActionParticipationRequestPending).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func TestParticipationCreate_Success_NotifiesOnce(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "ok")

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(gdb *gorm.DB, req models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
		createActionParticipationRequestNotification(gdb, req)
	})

	code, body := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 1 {
		t.Fatal("expected pending request")
	}
	if atomic.LoadInt32(&notifyCalls) != 1 {
		t.Fatalf("notify calls=%d", notifyCalls)
	}
	if countParticipationNotifs(t, db, f.target.ID) != 1 {
		t.Fatal("expected one in-app notification")
	}
	var n models.Obavestenje
	if err := db.Where("user_id = ? AND type = ?", f.target.ID, models.ObavestenjeTipActionParticipationRequest).First(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n.Title != "Zahtev za potvrdu učešća na akciji" {
		t.Fatalf("title=%q", n.Title)
	}
	if !strings.Contains(n.Body, f.akcija.Naziv) {
		t.Fatalf("body=%q", n.Body)
	}
	if !strings.Contains(n.Metadata, `"requestId"`) || !strings.Contains(n.Metadata, `"akcijaId"`) {
		t.Fatalf("metadata=%q", n.Metadata)
	}
}

func TestParticipationCreate_NotifySeesCommittedRequest(t *testing.T) {
	db := testParticipationCreateDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)
	f := seedParticipationCreate(t, db, "commit")

	var sawCommitted bool
	setParticipationCreateNotifyForTest(t, func(gdb *gorm.DB, req models.ActionParticipationRequest) {
		// Nova konekcija iz poola: request mora biti već commitovan.
		var found models.ActionParticipationRequest
		if err := gdb.First(&found, req.ID).Error; err != nil {
			t.Errorf("notify must see committed request: %v", err)
			return
		}
		if found.Status != models.ActionParticipationRequestPending {
			t.Errorf("status=%q", found.Status)
		}
		sawCommitted = true
		createActionParticipationRequestNotification(gdb, req)
	})

	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	if !sawCommitted {
		t.Fatal("notify did not observe committed row")
	}
}

func TestParticipationCreate_InsertError_NoNotify(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "ins_err")

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	cbName := "fail_part_create_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_participation_requests" {
			_ = tx.AddError(errors.New("forced insert failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 0 {
		t.Fatal("request must roll back")
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("notify must not run on domain failure")
	}
}

func TestParticipationCreate_DuplicatePending_NoNotify(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "dup")
	if err := db.Create(&models.ActionParticipationRequest{
		AkcijaID: f.akcija.ID, TargetUserID: f.target.ID, RequestedByID: f.admin.ID,
		Status: models.ActionParticipationRequestPending,
	}).Error; err != nil {
		t.Fatal(err)
	}

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusConflict {
		t.Fatalf("status=%d want 409", code)
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 1 {
		t.Fatal("still one pending")
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify on duplicate")
	}
}

func TestParticipationCreate_Unauthorized_NoNotify(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "unauth")
	stranger := models.Korisnik{Username: "str_c", Password: "x", Role: "clan"}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	code, _ := callCreateParticipation(t, db, f.akcija.ID, stranger, f.klubID, f.target.ID)
	if code != http.StatusForbidden {
		t.Fatalf("status=%d want 403", code)
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify")
	}
}

func TestParticipationCreate_CancelledLifecycle_NoNotify(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "canc")
	if err := db.Model(&f.akcija).Updates(map[string]any{"is_cancelled": true}).Error; err != nil {
		t.Fatal(err)
	}

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusConflict {
		t.Fatalf("status=%d want 409", code)
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 0 {
		t.Fatal("no request")
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify")
	}
}

func TestParticipationCreate_PostInsertPreCommitFailure_NoNotify(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "precom")

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	cbName := "fail_after_part_create_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().After("gorm:create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "action_participation_requests" {
			_ = tx.AddError(errors.New("forced post-insert pre-commit failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 0 {
		t.Fatal("request must not remain after rollback")
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("notify must not run")
	}
}

func TestParticipationCreate_NotifyFailure_StillSuccess(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "nf")

	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		panic("forced notify failure")
	})

	code, body := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v want 200 despite notify failure", code, body)
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 1 {
		t.Fatal("request must remain")
	}
}

func TestParticipationCreate_InAppInsertFailure_StillSuccess(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "inapp")

	// Real notify path; drop table so in-app insert fails best-effort.
	setParticipationCreateNotifyForTest(t, createActionParticipationRequestNotification)
	if err := db.Migrator().DropTable(&models.Obavestenje{}); err != nil {
		t.Fatal(err)
	}

	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d want 200", code)
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 1 {
		t.Fatal("request must remain")
	}
}

func TestParticipationCreate_ParallelCreates_OneNotify(t *testing.T) {
	db := testParticipationCreateDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1) // serializuje SQLite; i dalje provjerava exact-once ishod
	f := seedParticipationCreate(t, db, "par")

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(gdb *gorm.DB, req models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
		createActionParticipationRequestNotification(gdb, req)
	})

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
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
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 1 {
		t.Fatal("one pending request")
	}
	if atomic.LoadInt32(&notifyCalls) != 1 {
		t.Fatalf("notify once, got %d", notifyCalls)
	}
	if countParticipationNotifs(t, db, f.target.ID) != 1 {
		t.Fatal("one notification row")
	}
}

func TestParticipationCreate_CancelFirst_NoNotify(t *testing.T) {
	db := testParticipationCreateDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)
	f := seedParticipationCreate(t, db, "canc1")

	var paused int32
	reached := make(chan struct{})
	cont := make(chan struct{})
	cbName := "part_create_before_akcija_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" || !statementHasForUpdate(tx.Statement) {
			return
		}
		if !atomic.CompareAndSwapInt32(&paused, 0, 1) {
			return
		}
		close(reached)
		<-cont
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })

	var notifyCalls int32
	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		atomic.AddInt32(&notifyCalls, 1)
	})

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	}()
	<-reached
	if err := db.Model(&models.Akcija{}).Where("id = ?", f.akcija.ID).Update("is_cancelled", true).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status=%d want 409", code)
	}
	if countPendingParticipation(t, db, f.akcija.ID, f.target.ID) != 0 {
		t.Fatal("no request")
	}
	if atomic.LoadInt32(&notifyCalls) != 0 {
		t.Fatal("no notify")
	}
}

func TestParticipationCreate_NotifyHookRestored(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "hook1")

	var calls int32
	setParticipationCreateNotifyForTest(t, func(*gorm.DB, models.ActionParticipationRequest) {
		atomic.AddInt32(&calls, 1)
	})
	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Fatal("override must be used")
	}
	if countParticipationNotifs(t, db, f.target.ID) != 0 {
		t.Fatal("override suppressed real notify")
	}
}

func TestParticipationCreate_NotifyHooksIsolatedBetweenTests(t *testing.T) {
	db := testParticipationCreateDB(t)
	f := seedParticipationCreate(t, db, "hook2")

	prev := participationCreateNotify
	participationCreateNotify = func(*gorm.DB, models.ActionParticipationRequest) {}
	t.Cleanup(func() { participationCreateNotify = prev })

	code, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, f.target.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	if countParticipationNotifs(t, db, f.target.ID) != 0 {
		t.Fatal("override must suppress notify")
	}

	participationCreateNotify = prev
	other := models.Korisnik{Username: "tgt_hook2b", Password: "x", Role: "clan"}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	code2, _ := callCreateParticipation(t, db, f.akcija.ID, f.admin, f.klubID, other.ID)
	if code2 != http.StatusOK {
		t.Fatalf("status=%d", code2)
	}
	if countParticipationNotifs(t, db, other.ID) != 1 {
		t.Fatal("restored default notify must create in-app row")
	}
}

func TestParticipationCreate_UsesUniqueMemoryDSN(t *testing.T) {
	db1 := testParticipationCreateDB(t)
	db2 := testParticipationCreateDB(t)
	f1 := seedParticipationCreate(t, db1, "dsn1")
	var n int64
	if err := db2.Model(&models.Korisnik{}).Where("username = ?", f1.admin.Username).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("sibling DSN must not see other suite rows")
	}
}
