package handlers

import (
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"gorm.io/gorm"
)

func seedDeleteGuardOwner(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "vodic"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedDeleteGuardAkcija(t *testing.T, db *gorm.DB, owner models.Korisnik, completed bool) models.Akcija {
	t.Helper()
	a := models.Akcija{
		Naziv: "Guard", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
		IsCompleted: completed,
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func assertDeleteConflict(t *testing.T, code int, body map[string]any, wantErr error) {
	t.Helper()
	if code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%v", code, body)
	}
	errMsg, _ := body["error"].(string)
	if errMsg != wantErr.Error() {
		t.Fatalf("expected error %q, got %q", wantErr.Error(), errMsg)
	}
}

func TestDeleteAkcijaGuard_BlocksPrijavaStatuses(t *testing.T) {
	statuses := []string{"prijavljen", "popeo se", "nije uspeo", "otkazano"}
	for _, status := range statuses {
		t.Run(status, func(t *testing.T) {
			db := testDeleteAkcijaDB(t)
			owner := seedDeleteGuardOwner(t, db, "own_"+status)
			member := models.Korisnik{Username: "mem_" + status, Password: "x", Role: "clan"}
			if err := db.Create(&member).Error; err != nil {
				t.Fatal(err)
			}
			akcija := seedDeleteGuardAkcija(t, db, owner, false)
			platio := status == "prijavljen"
			if err := db.Create(&models.Prijava{
				AkcijaID: akcija.ID, KorisnikID: member.ID, Status: status, Platio: platio,
			}).Error; err != nil {
				t.Fatal(err)
			}
			if status == "popeo se" {
				member.UkupnoKmKorisnik = 10
				member.BrojPopeoSe = 1
				if err := db.Save(&member).Error; err != nil {
					t.Fatal(err)
				}
			}

			code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
			assertDeleteConflict(t, code, body, helpers.ErrAkcijaHardDeleteHasPrijave)

			if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
				t.Fatal("akcija must remain")
			}
			if countWhere(t, db, &models.Prijava{}, "akcija_id = ?", akcija.ID) != 1 {
				t.Fatal("prijava must remain")
			}
			if status == "popeo se" {
				var reloaded models.Korisnik
				if err := db.First(&reloaded, member.ID).Error; err != nil {
					t.Fatal(err)
				}
				if reloaded.BrojPopeoSe != 1 || reloaded.UkupnoKmKorisnik != 10 {
					t.Fatal("user stats must not change on blocked delete")
				}
			}
			if platio {
				var p models.Prijava
				if err := db.Where("akcija_id = ?", akcija.ID).First(&p).Error; err != nil {
					t.Fatal(err)
				}
				if !p.Platio {
					t.Fatal("Platio must remain true")
				}
			}
		})
	}
}

func TestDeleteAkcijaGuard_BlocksSignupRequestStatuses(t *testing.T) {
	statuses := []string{
		models.ActionSignupRequestPending,
		models.ActionSignupRequestAccepted,
		models.ActionSignupRequestRejected,
		models.ActionSignupRequestCancelled,
	}
	for _, status := range statuses {
		t.Run(status, func(t *testing.T) {
			db := testDeleteAkcijaDB(t)
			owner := seedDeleteGuardOwner(t, db, "own_sr_"+status)
			reqUser := models.Korisnik{Username: "req_" + status, Password: "x", Role: "clan"}
			if err := db.Create(&reqUser).Error; err != nil {
				t.Fatal(err)
			}
			akcija := seedDeleteGuardAkcija(t, db, owner, false)
			if err := db.Create(&models.ActionSignupRequest{
				AkcijaID: akcija.ID, RequesterID: reqUser.ID, Status: status,
			}).Error; err != nil {
				t.Fatal(err)
			}

			code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
			assertDeleteConflict(t, code, body, helpers.ErrAkcijaHardDeleteHasSignupRequests)

			if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
				t.Fatal("akcija must remain")
			}
			if countWhere(t, db, &models.ActionSignupRequest{}, "akcija_id = ?", akcija.ID) != 1 {
				t.Fatal("signup request must remain")
			}
		})
	}
}

func TestDeleteAkcijaGuard_BlocksCompletedWithoutPrijave(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_done")
	akcija := seedDeleteGuardAkcija(t, db, owner, true)

	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	assertDeleteConflict(t, code, body, helpers.ErrAkcijaHardDeleteCompleted)
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("completed akcija must remain")
	}
}

func TestDeleteAkcijaGuard_BlocksCompletedWithPrijave(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_done_p")
	member := models.Korisnik{Username: "mem_done_p", Password: "x", Role: "clan"}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}
	akcija := seedDeleteGuardAkcija(t, db, owner, true)
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "popeo se",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	assertDeleteConflict(t, code, body, helpers.ErrAkcijaHardDeleteCompleted)
}

func TestDeleteAkcijaGuard_BlocksCompletedWithTransakcija(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	if err := db.AutoMigrate(&models.Transakcija{}); err != nil {
		t.Fatal(err)
	}
	owner := seedDeleteGuardOwner(t, db, "own_tx")
	akcija := seedDeleteGuardAkcija(t, db, owner, true)
	if err := db.Create(&models.Transakcija{
		Tip: "uplata", Iznos: 100, Opis: "Prihod sa akcije: " + akcija.Naziv,
		Datum: time.Now(), KorisnikID: owner.ID,
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	assertDeleteConflict(t, code, body, helpers.ErrAkcijaHardDeleteCompleted)
	if countWhere(t, db, &models.Transakcija{}, "1 = 1") != 1 {
		t.Fatal("transakcija must remain")
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("akcija must remain")
	}
}

func TestDeleteAkcijaGuard_CountPrijaveErrorRollsBack(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_cnt_p")
	akcija := seedDeleteGuardAkcija(t, db, owner, false)

	cbName := "fail_prijava_count"
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(gdb *gorm.DB) {
		if gdb.Statement != nil && gdb.Statement.Table == "prijave" {
			_ = gdb.AddError(errors.New("forced prijava count failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer db.Callback().Query().Remove(cbName)

	err := db.Transaction(func(tx *gorm.DB) error {
		return deleteAkcijaDataTx(tx, akcija.ID)
	})
	if err == nil || err.Error() != "forced prijava count failure" {
		t.Fatalf("expected count failure, got %v", err)
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("akcija must remain after count failure")
	}
}

func TestDeleteAkcijaGuard_CountSignupErrorRollsBack(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_cnt_s")
	akcija := seedDeleteGuardAkcija(t, db, owner, false)

	cbName := "fail_signup_count"
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(gdb *gorm.DB) {
		if gdb.Statement != nil && gdb.Statement.Table == "action_signup_requests" {
			_ = gdb.AddError(errors.New("forced signup count failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer db.Callback().Query().Remove(cbName)

	err := db.Transaction(func(tx *gorm.DB) error {
		return deleteAkcijaDataTx(tx, akcija.ID)
	})
	if err == nil || err.Error() != "forced signup count failure" {
		t.Fatalf("expected count failure, got %v", err)
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("akcija must remain after count failure")
	}
}

func TestDeleteAkcijaGuard_ValidateDirectly(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_val")
	akcija := seedDeleteGuardAkcija(t, db, owner, false)

	err := db.Transaction(func(tx *gorm.DB) error {
		locked, lockErr := helpers.LockAkcijaForUpdate(tx, akcija.ID)
		if lockErr != nil {
			return lockErr
		}
		return helpers.ValidateAkcijaCanBeHardDeletedTx(tx, locked)
	})
	if err != nil {
		t.Fatalf("empty akcija should pass guard: %v", err)
	}
}

func TestDeleteAkcijaGuard_FinishThenDeleteConflict(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	if err := db.AutoMigrate(&models.Transakcija{}); err != nil {
		t.Fatal(err)
	}
	owner := seedDeleteGuardOwner(t, db, "own_fin_del")
	akcija := seedDeleteGuardAkcija(t, db, owner, false)

	_, err := actions.FinishAction(db, &akcija, owner, actions.FinishActionInput{})
	if err != nil {
		t.Fatalf("finish: %v", err)
	}

	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	assertDeleteConflict(t, code, body, helpers.ErrAkcijaHardDeleteCompleted)

	var reloaded models.Akcija
	if err := db.First(&reloaded, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !reloaded.IsCompleted {
		t.Fatal("akcija must stay completed")
	}
}

func TestDeleteAkcijaGuard_DeleteThenFinishNotFound(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	if err := db.AutoMigrate(&models.Transakcija{}); err != nil {
		t.Fatal(err)
	}
	owner := seedDeleteGuardOwner(t, db, "own_del_fin")
	akcija := seedDeleteGuardAkcija(t, db, owner, false)

	code, _ := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("delete status %d", code)
	}

	_, err := actions.FinishAction(db, &akcija, owner, actions.FinishActionInput{})
	if err == nil {
		t.Fatal("finish on deleted akcija should fail")
	}
	if countWhere(t, db, &models.Transakcija{}, "1 = 1") != 0 {
		t.Fatal("finish must not create transakcija after delete")
	}
}

func TestDeleteAkcijaGuard_AcceptThenDeleteConflict(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_acc_del")
	requester := models.Korisnik{Username: "req_acc", Password: "x", Role: "clan"}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}
	akcija := seedDeleteGuardAkcija(t, db, owner, false)
	akcija.MaxLjudi = 5
	if err := db.Save(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	_, err := acceptSignupTx(t, db, akcija, requester, prijavaChoicesPayload{})
	if err != nil {
		t.Fatalf("accept: %v", err)
	}

	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	assertDeleteConflict(t, code, body, helpers.ErrAkcijaHardDeleteHasPrijave)
}

func TestDeleteAkcijaGuard_DeleteThenAcceptFails(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_del_acc")
	requester := models.Korisnik{Username: "req_del_acc", Password: "x", Role: "clan"}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}
	akcija := seedDeleteGuardAkcija(t, db, owner, false)
	akcija.MaxLjudi = 5
	if err := db.Save(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("delete status %d", code)
	}

	_, err := acceptSignupTx(t, db, akcija, requester, prijavaChoicesPayload{})
	if err == nil {
		t.Fatal("accept after delete should fail")
	}
}

func TestDeleteAkcijaGuard_ParallelDeleteOneWins(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_par_del")
	akcija := seedDeleteGuardAkcija(t, db, owner, false)
	id := akcija.ID

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx], _ = callDeleteAkcija(t, db, id, owner.Username, "vodic")
		}(i)
	}
	wg.Wait()

	ok := 0
	notFound := 0
	for _, code := range codes {
		switch code {
		case http.StatusOK:
			ok++
		case http.StatusNotFound:
			notFound++
		default:
			t.Fatalf("unexpected status %d", code)
		}
	}
	if ok != 1 || notFound != 1 {
		t.Fatalf("expected one 200 and one 404, got codes=%v", codes)
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", id) != 0 {
		t.Fatal("akcija must be deleted exactly once")
	}
}

func TestDeleteAkcijaGuard_UnauthorizedDoesNotHitGuard(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "own_unauth")
	stranger := models.Korisnik{Username: "str_guard", Password: "x", Role: "clan"}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}
	akcija := seedDeleteGuardAkcija(t, db, owner, false)
	member := models.Korisnik{Username: "mem_unauth", Password: "x", Role: "clan"}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeleteAkcija(t, db, akcija.ID, stranger.Username, "clan")
	if code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("akcija must remain")
	}
}

func TestValidateAkcijaCanBeHardDeletedTx_Completed(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := seedDeleteGuardOwner(t, db, "val_done")
	akcija := seedDeleteGuardAkcija(t, db, owner, true)

	err := db.Transaction(func(tx *gorm.DB) error {
		return helpers.ValidateAkcijaCanBeHardDeletedTx(tx, &akcija)
	})
	if !errors.Is(err, helpers.ErrAkcijaHardDeleteCompleted) {
		t.Fatalf("expected ErrAkcijaHardDeleteCompleted, got %v", err)
	}
}

func TestValidateAkcijaCanBeHardDeletedTx_NilAkcija(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	err := db.Transaction(func(tx *gorm.DB) error {
		return helpers.ValidateAkcijaCanBeHardDeletedTx(tx, nil)
	})
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
}
