package handlers

import (
	"errors"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"gorm.io/gorm"
)

func seedParticipationRespondPair(t *testing.T, db *gorm.DB, suffix string) (admin, target models.Korisnik, akcija models.Akcija, req models.ActionParticipationRequest) {
	t.Helper()
	klubID := uint(10 + len(suffix)%50)
	admin = models.Korisnik{Username: "adm_" + suffix, Password: "x", Role: "admin", KlubID: &klubID}
	target = models.Korisnik{Username: "tgt_" + suffix, Password: "x", Role: "clan", KlubID: &klubID}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&target).Error; err != nil {
		t.Fatal(err)
	}
	akcija = models.Akcija{
		Naziv: "Done " + suffix, Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		UkupnoKmAkcija: 5, UkupnoMetaraUsponaAkcija: 300, KlubID: &klubID, VodicID: admin.ID, AddedByID: admin.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	req = models.ActionParticipationRequest{
		AkcijaID: akcija.ID, TargetUserID: target.ID, RequestedByID: admin.ID,
		Status: models.ActionParticipationRequestPending,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatal(err)
	}
	return admin, target, akcija, req
}

func reloadParticipationRequest(t *testing.T, db *gorm.DB, id uint) models.ActionParticipationRequest {
	t.Helper()
	var req models.ActionParticipationRequest
	if err := db.First(&req, id).Error; err != nil {
		t.Fatal(err)
	}
	return req
}

func countParticipationPrijave(t *testing.T, db *gorm.DB, akcijaID, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, userID).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func reloadKorisnikBrojPopeoSe(t *testing.T, db *gorm.DB, id uint) int {
	t.Helper()
	var u models.Korisnik
	if err := db.First(&u, id).Error; err != nil {
		t.Fatal(err)
	}
	return u.BrojPopeoSe
}

func pauseBeforeParticipationAkcijaLock(t *testing.T, db *gorm.DB, reached chan<- struct{}, cont <-chan struct{}) func() {
	t.Helper()
	var paused int32
	cbName := "part_before_akcija_" + strings.ReplaceAll(t.Name(), "/", "_")
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
	return func() { _ = db.Callback().Query().Remove(cbName) }
}

func pauseAfterParticipationAkcijaLock(t *testing.T, db *gorm.DB, locked chan<- struct{}, cont <-chan struct{}) func() {
	t.Helper()
	var paused int32
	cbName := "part_after_akcija_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Query().After("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" || !statementHasForUpdate(tx.Statement) {
			return
		}
		if !atomic.CompareAndSwapInt32(&paused, 0, 1) {
			return
		}
		close(locked)
		<-cont
	}); err != nil {
		t.Fatal(err)
	}
	return func() { _ = db.Callback().Query().Remove(cbName) }
}

func TestParticipationRespond_Accept_Success(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "acc_ok")

	code, body := callRespondParticipation(t, db, req.ID, target, "accept")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestAccepted {
		t.Fatal("request must be accepted")
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 1 {
		t.Fatal("expected one prijava")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 1 {
		t.Fatal("stats must bump once")
	}
	var p models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, target.ID).First(&p).Error; err != nil {
		t.Fatal(err)
	}
	if p.Status != "popeo se" || !p.Platio {
		t.Fatalf("prijava status=%q platio=%v", p.Status, p.Platio)
	}
}

func TestParticipationRespond_Reject_NoPrijava(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "rej_ok")

	code, body := callRespondParticipation(t, db, req.ID, target, "reject")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestRejected {
		t.Fatal("request must be rejected")
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("reject must not create prijava")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
		t.Fatal("reject must not bump stats")
	}
}

func TestParticipationRespond_Unauthorized_Forbidden(t *testing.T) {
	db := testParticipationDB(t)
	admin, _, _, req := seedParticipationRespondPair(t, db, "unauth")

	code, _ := callRespondParticipation(t, db, req.ID, admin, "accept")
	if code != http.StatusForbidden {
		t.Fatalf("status=%d want 403", code)
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestPending {
		t.Fatal("request must stay pending")
	}
}

func TestParticipationRespond_NotFound(t *testing.T) {
	db := testParticipationDB(t)
	_, target, _, _ := seedParticipationRespondPair(t, db, "nf")
	code, body := callRespondParticipation(t, db, 99999, target, "accept")
	if code != http.StatusNotFound {
		t.Fatalf("status=%d body=%v", code, body)
	}
	if code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestParticipationRespond_RequestActionMismatch_NoMutation(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	_, target, akcija, req := seedParticipationRespondPair(t, db, "mis_act")
	other := models.Akcija{
		Naziv: "Other", Datum: time.Now().Add(-48 * time.Hour), IsCompleted: true,
		VodicID: akcija.VodicID, AddedByID: akcija.AddedByID, KlubID: akcija.KlubID,
	}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterParticipationAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-locked
	if err := db.Model(&models.ActionParticipationRequest{}).Where("id = ?", req.ID).
		Update("akcija_id", other.ID).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusNotFound && code != http.StatusConflict {
		t.Fatalf("status=%d want safe 404/409", code)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("no prijava on original action")
	}
	if countParticipationPrijave(t, db, other.ID, target.ID) != 0 {
		t.Fatal("no prijava on mismatched action")
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestPending {
		t.Fatal("request must stay pending")
	}
}

func TestParticipationRespond_TargetMismatch_NoMutation(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	_, target, akcija, req := seedParticipationRespondPair(t, db, "mis_tgt")
	otherUser := models.Korisnik{Username: "other_tgt", Password: "x", Role: "clan"}
	if err := db.Create(&otherUser).Error; err != nil {
		t.Fatal(err)
	}

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterParticipationAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-locked
	if err := db.Model(&models.ActionParticipationRequest{}).Where("id = ?", req.ID).
		Update("target_user_id", otherUser.ID).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusForbidden {
		t.Fatalf("status=%d want 403", code)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("no prijava for original target")
	}
	if countParticipationPrijave(t, db, akcija.ID, otherUser.ID) != 0 {
		t.Fatal("no prijava for swapped target")
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestPending {
		t.Fatal("request must stay pending")
	}
}

func TestParticipationRespond_PreReadPending_LockedAlreadyAccepted(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	_, target, akcija, req := seedParticipationRespondPair(t, db, "term_acc")

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterParticipationAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-locked
	now := time.Now()
	if err := db.Model(&models.ActionParticipationRequest{}).Where("id = ?", req.ID).Updates(map[string]any{
		"status":       models.ActionParticipationRequestAccepted,
		"responded_at": now,
	}).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusBadRequest {
		t.Fatalf("status=%d want 400 already handled", code)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("no second processing")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
		t.Fatal("no stats from terminal retry")
	}
}

func TestParticipationRespond_PreReadAllows_LockedCancelled(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	_, target, akcija, req := seedParticipationRespondPair(t, db, "canc_lock")

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeParticipationAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-reached
	if err := db.Model(&models.Akcija{}).Where("id = ?", akcija.ID).Updates(map[string]any{
		"is_cancelled": true,
	}).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status=%d body=%v want 409", code, body)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("no prijava")
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestPending {
		t.Fatal("request pending")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
		t.Fatal("no stats")
	}
}

func TestParticipationRespond_LockedAuthNoLongerPasses(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	_, target, akcija, req := seedParticipationRespondPair(t, db, "auth_lock")
	stranger := models.Korisnik{Username: "str_auth", Password: "x", Role: "clan"}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterParticipationAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-locked
	if err := db.Model(&models.ActionParticipationRequest{}).Where("id = ?", req.ID).
		Update("target_user_id", stranger.ID).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusForbidden {
		t.Fatalf("status=%d want 403", code)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("no mutation")
	}
}

func TestParticipationRespond_StalePrijavaUsesLockedStatus(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	admin, target, akcija, req := seedParticipationRespondPair(t, db, "stale_p")
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: target.ID, Status: "prijavljen", Platio: false}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{PrijavaID: p.ID}).Error; err != nil {
		t.Fatal(err)
	}

	locked := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseAfterParticipationAkcijaLock(t, db, locked, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-locked
	// Host marks summited + stats while respond holds action lock (status mutation waits on akcija).
	// Flip status outside respond's prijava lock path via direct update to simulate stale pre-read.
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}
	_ = admin
	close(cont)
	wg.Wait()

	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
		t.Fatal("already popeo se on locked row → no stats bump")
	}
	var updated models.Prijava
	if err := db.First(&updated, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !updated.Platio || updated.Status != "popeo se" {
		t.Fatalf("prijava=%+v", updated)
	}
}

func TestParticipationRespond_ParallelAccepts_OneWins(t *testing.T) {
	// MaxOpenConns(1) kao signup parallel testovi: serializuje SQLite konekcije,
	// a i dalje pokriva exact-once ishod (jedan OK, jedan already-handled).
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "par_acc")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callRespondParticipation(t, db, req.ID, target, "accept")
		}(i)
	}
	wg.Wait()

	ok, handled := 0, 0
	for _, c := range codes {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusBadRequest:
			handled++
		default:
			t.Fatalf("unexpected codes=%v", codes)
		}
	}
	if ok != 1 || handled != 1 {
		t.Fatalf("expected 1 ok + 1 handled, codes=%v", codes)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 1 {
		t.Fatal("exactly one prijava")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 1 {
		t.Fatal("stats exactly once")
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestAccepted {
		t.Fatal("accepted once")
	}
}

func TestParticipationRespond_AcceptRejectRace_OneTerminal(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "ar_race")

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		codes[0], _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	go func() {
		defer wg.Done()
		codes[1], _ = callRespondParticipation(t, db, req.ID, target, "reject")
	}()
	wg.Wait()

	ok, handled := 0, 0
	for _, c := range codes {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusBadRequest:
			handled++
		default:
			t.Fatalf("unexpected codes=%v", codes)
		}
	}
	if ok != 1 || handled != 1 {
		t.Fatalf("expected 1 ok + 1 handled, codes=%v", codes)
	}
	st := reloadParticipationRequest(t, db, req.ID).Status
	switch st {
	case models.ActionParticipationRequestAccepted:
		if countParticipationPrijave(t, db, akcija.ID, target.ID) != 1 {
			t.Fatal("accepted must have prijava")
		}
		if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 1 {
			t.Fatal("accepted must bump stats")
		}
	case models.ActionParticipationRequestRejected:
		if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
			t.Fatal("rejected must not have prijava")
		}
		if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
			t.Fatal("rejected must not bump stats")
		}
	default:
		t.Fatalf("unexpected status %s", st)
	}
}

func TestParticipationRespond_CancelFirst_Blocked(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	_, target, akcija, req := seedParticipationRespondPair(t, db, "canc_1st")

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeParticipationAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-reached
	// Completed akcije CancelAction odbija; simuliraj cancel-first commit postavljanjem IsCancelled.
	if err := db.Model(&models.Akcija{}).Where("id = ?", akcija.ID).Updates(map[string]any{
		"is_cancelled": true,
	}).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status=%d want 409", code)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("no prijava/stats")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
		t.Fatal("no stats")
	}
}

func TestParticipationRespond_RespondFirst_ThenCancelSeesCompleted(t *testing.T) {
	db := testParticipationDB(t)
	admin, target, akcija, req := seedParticipationRespondPair(t, db, "resp_1st")

	code, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code != http.StatusOK {
		t.Fatalf("accept status=%d", code)
	}
	_, err := actions.CancelAction(db, akcija.ID, "kasnije", admin.ID, nil)
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("cancel after completed respond: %v", err)
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestAccepted {
		t.Fatal("request remains accepted")
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 1 {
		t.Fatal("prijava remains")
	}
}

func TestParticipationRespond_ParticipantStatusFirst_UsesLocked(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	admin, target, akcija, req := seedParticipationRespondPair(t, db, "ps_1st")
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: target.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{PrijavaID: p.ID}).Error; err != nil {
		t.Fatal(err)
	}

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeParticipationAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-reached
	stCode, _ := callUpdatePrijavaStatus(t, db, p.ID, "popeo se", admin.Username, "admin")
	if stCode != http.StatusOK {
		t.Fatalf("status mutation=%d", stCode)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusOK {
		t.Fatalf("respond status=%d", code)
	}
	// Status mutation already bumped stats; accept must not bump again.
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 1 {
		t.Fatalf("stats=%d want 1", reloadKorisnikBrojPopeoSe(t, db, target.ID))
	}
}

func TestParticipationRespond_RespondFirst_StatusMutationSeesPopeoSe(t *testing.T) {
	db := testParticipationDB(t)
	admin, target, akcija, req := seedParticipationRespondPair(t, db, "ps_2nd")

	code, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code != http.StatusOK {
		t.Fatalf("accept=%d", code)
	}
	var p models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, target.ID).First(&p).Error; err != nil {
		t.Fatal(err)
	}
	stCode, _ := callUpdatePrijavaStatus(t, db, p.ID, "nije uspeo", admin.Username, "admin")
	if stCode != http.StatusOK {
		t.Fatalf("status mutation=%d", stCode)
	}
	var updated models.Prijava
	if err := db.First(&updated, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if updated.Status != "nije uspeo" {
		t.Fatalf("status=%q", updated.Status)
	}
}

func TestParticipationRespond_LockOrderAkcijaRequestPrijava(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "lock_ord")
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: target.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	order := registerLockOrderProbe(t, db)
	code, body := callRespondParticipation(t, db, req.ID, target, "accept")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	firstAkcija, firstReq, firstPrijava := -1, -1, -1
	for i, table := range *order {
		switch table {
		case "akcije":
			if firstAkcija < 0 {
				firstAkcija = i
			}
		case "action_participation_requests":
			if firstReq < 0 {
				firstReq = i
			}
		case "prijave":
			if firstPrijava < 0 {
				firstPrijava = i
			}
		}
	}
	if firstAkcija < 0 || firstReq < 0 || firstPrijava < 0 {
		t.Fatalf("missing locks order=%v", *order)
	}
	if !(firstAkcija < firstReq && firstReq < firstPrijava) {
		t.Fatalf("want Akcija→Request→Prijava, order=%v", *order)
	}
	for i := 0; i < len(*order); i++ {
		if (*order)[i] == "action_participation_requests" {
			for j := i + 1; j < len(*order); j++ {
				if (*order)[j] == "akcije" {
					t.Fatalf("Request→Akcija forbidden, order=%v", *order)
				}
			}
		}
		if (*order)[i] == "prijave" {
			for j := i + 1; j < len(*order); j++ {
				if (*order)[j] == "akcije" {
					t.Fatalf("Prijava→Akcija forbidden, order=%v", *order)
				}
			}
		}
	}
}

func TestParticipationRespond_ExistingPrijava_NoDuplicate(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "exist_p")
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: target.ID, Status: "nije uspeo", Platio: false}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 1 {
		t.Fatal("no duplicate prijava")
	}
	var updated models.Prijava
	if err := db.First(&updated, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if updated.Status != "popeo se" || !updated.Platio {
		t.Fatalf("updated=%+v", updated)
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 1 {
		t.Fatal("stats once")
	}

	code2, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code2 != http.StatusBadRequest {
		t.Fatalf("retry status=%d", code2)
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 1 {
		t.Fatal("still one prijava")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 1 {
		t.Fatal("stats still once")
	}
}

func TestParticipationRespond_IzboriFailure_RollsBackRequestAndStats(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "rb_izb")

	cbName := "fail_part_izbori_lock_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:before_create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "prijava_izbori" {
			_ = tx.AddError(errors.New("forced izbori failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	code, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("prijava rollback")
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestPending {
		t.Fatal("request pending")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
		t.Fatal("stats rollback")
	}
}

func TestParticipationRespond_StatsFailure_RollsBackPrijavaAndRequest(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "rb_stats")

	var saveHits int32
	cbName := "fail_part_stats_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Update().Before("gorm:before_update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "korisnici" {
			return
		}
		if atomic.AddInt32(&saveHits, 1) == 1 {
			_ = tx.AddError(errors.New("forced stats failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("prijava rollback")
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestPending {
		t.Fatal("request pending")
	}
}

func TestParticipationRespond_TerminalUpdateFailure_RollsBack(t *testing.T) {
	db := testParticipationDB(t)
	_, target, akcija, req := seedParticipationRespondPair(t, db, "rb_term")

	cbName := "fail_part_term_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Update().Before("gorm:before_update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "action_participation_requests" {
			return
		}
		_ = tx.AddError(errors.New("forced terminal update failure"))
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, _ := callRespondParticipation(t, db, req.ID, target, "accept")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countParticipationPrijave(t, db, akcija.ID, target.ID) != 0 {
		t.Fatal("prijava rollback")
	}
	if reloadParticipationRequest(t, db, req.ID).Status != models.ActionParticipationRequestPending {
		t.Fatal("request pending")
	}
	if reloadKorisnikBrojPopeoSe(t, db, target.ID) != 0 {
		t.Fatal("stats rollback")
	}
}

func TestParticipationRespond_GuardConflict_NoWriteAfter(t *testing.T) {
	db := testParticipationDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	_, target, akcija, req := seedParticipationRespondPair(t, db, "guard_w")

	var wrotePrijava int32
	cbName := "part_guard_write_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:before_create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijave" {
			atomic.AddInt32(&wrotePrijava, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforeParticipationAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callRespondParticipation(t, db, req.ID, target, "accept")
	}()
	<-reached
	if err := db.Model(&models.Akcija{}).Where("id = ?", akcija.ID).Update("is_cancelled", true).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status=%d", code)
	}
	if atomic.LoadInt32(&wrotePrijava) != 0 {
		t.Fatal("no prijava write after lifecycle guard")
	}
}
