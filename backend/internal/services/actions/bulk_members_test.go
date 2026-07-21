package actions

import (
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

func seedBulkMembers(t *testing.T, db *gorm.DB, count int) (models.Akcija, []models.Korisnik) {
	t.Helper()
	klubID := uint(10)
	suffix := strings.ReplaceAll(t.Name(), "/", "_")
	akcija := models.Akcija{
		Naziv:                    "Bulk uspon " + suffix,
		Datum:                    time.Now().Add(-24 * time.Hour),
		IsCompleted:              true,
		UkupnoKmAkcija:           5,
		UkupnoMetaraUsponaAkcija: 300,
		KlubID:                   &klubID,
		MaxLjudi:                 2,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	users := make([]models.Korisnik, count)
	for i := range users {
		users[i] = models.Korisnik{
			Username: "bulk_u_" + suffix + "_" + string(rune('a'+i)),
			Password: "x",
			Role:     "clan",
			KlubID:   &klubID,
		}
		if err := db.Create(&users[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	return akcija, users
}

func bulkIDs(users []models.Korisnik) []uint {
	ids := make([]uint, len(users))
	for i, u := range users {
		ids[i] = u.ID
	}
	return ids
}

func TestBulkAdd_MultipleNewMembers(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 3)

	res, err := BulkAddMembersToCompletedAction(db, &akcija, bulkIDs(users))
	if err != nil {
		t.Fatal(err)
	}
	if res.Added != 3 || res.Updated != 0 || res.Skipped != 0 || res.NewlySummited != 3 {
		t.Fatalf("counts=%+v", res)
	}
	for _, u := range users {
		if countPrijave(t, db, akcija.ID, u.ID) != 1 {
			t.Fatalf("prijava missing for %d", u.ID)
		}
		var p models.Prijava
		if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, u.ID).First(&p).Error; err != nil {
			t.Fatal(err)
		}
		if p.Status != "popeo se" || !p.Platio {
			t.Fatalf("unexpected prijava: %+v", p)
		}
		if countIzbori(t, db, p.ID) != 1 {
			t.Fatalf("missing izbori for %d", u.ID)
		}
		reloaded := reloadUser(t, db, u.ID)
		if reloaded.BrojPopeoSe != 1 || reloaded.UkupnoKmKorisnik != 5 {
			t.Fatalf("stats wrong: %+v", reloaded)
		}
	}
	if countSummitNotifs(t, db, users[0].ID) != 1 {
		t.Fatal("expected notification after commit")
	}
}

func TestBulkAdd_MixedStatuses(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 4)

	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: users[1].ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: users[2].ID, Status: "nije uspeo"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: users[3].ID, Status: "popeo se", Platio: true}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&users[3]).Updates(map[string]any{"broj_popeo_se": 5, "ukupno_km_korisnik": 50}).Error; err != nil {
		t.Fatal(err)
	}

	res, err := BulkAddMembersToCompletedAction(db, &akcija, bulkIDs(users))
	if err != nil {
		t.Fatal(err)
	}
	if res.Added != 1 || res.Updated != 2 || res.Skipped != 1 {
		t.Fatalf("counts=%+v results=%+v", res, res.Results)
	}
	u0 := reloadUser(t, db, users[0].ID)
	u3 := reloadUser(t, db, users[3].ID)
	if u0.BrojPopeoSe != 1 || u3.BrojPopeoSe != 5 {
		t.Fatalf("stats u0=%+v u3=%+v", u0, u3)
	}
}

func TestBulkAdd_DuplicateIDInPayload(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 1)
	ids := []uint{users[0].ID, users[0].ID}

	res, err := BulkAddMembersToCompletedAction(db, &akcija, ids)
	if err != nil {
		t.Fatal(err)
	}
	if res.Added != 1 || res.Skipped != 1 || res.Processed != 2 {
		t.Fatalf("counts=%+v", res)
	}
	if res.Results[1].Reason != "duplikat u listi" {
		t.Fatalf("reason=%q", res.Results[1].Reason)
	}
	u := reloadUser(t, db, users[0].ID)
	if u.BrojPopeoSe != 1 {
		t.Fatalf("double stats: %+v", u)
	}
}

func TestBulkAdd_UnexpectedErrorRollsBackBatch(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 2)

	cbName := "bulk_fail_stats_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Update().Before("gorm:before_update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "korisnici" {
			_ = tx.AddError(errors.New("forced stats failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := BulkAddMembersToCompletedAction(db, &akcija, bulkIDs(users))
	if err == nil {
		t.Fatal("expected failure")
	}
	for _, u := range users {
		if countPrijave(t, db, akcija.ID, u.ID) != 0 {
			t.Fatal("batch must roll back all prijave")
		}
		reloaded := reloadUser(t, db, u.ID)
		if reloaded.BrojPopeoSe != 0 {
			t.Fatal("stats must roll back")
		}
	}
}

func TestBulkAdd_InvalidMemberSkippedOthersProcessed(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 1)
	otherKlub := uint(99)
	outsider := models.Korisnik{Username: "out_" + t.Name(), Password: "x", Role: "clan", KlubID: &otherKlub}
	if err := db.Create(&outsider).Error; err != nil {
		t.Fatal(err)
	}

	res, err := BulkAddMembersToCompletedAction(db, &akcija, []uint{99999, outsider.ID, users[0].ID})
	if err != nil {
		t.Fatal(err)
	}
	if res.Added != 1 || res.Skipped != 2 {
		t.Fatalf("counts=%+v", res)
	}
	if countPrijave(t, db, akcija.ID, users[0].ID) != 1 {
		t.Fatal("valid member should be saved")
	}
}

func TestBulkAdd_ConcurrentSameMember(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 1)

	var wg sync.WaitGroup
	errs := make([]error, 4)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			a := akcija
			_, errs[idx] = BulkAddMembersToCompletedAction(db, &a, bulkIDs(users))
		}(i)
	}
	wg.Wait()
	successes := 0
	for _, err := range errs {
		if err == nil {
			successes++
		}
	}
	if successes < 1 {
		t.Fatalf("expected at least one success, errs=%v", errs)
	}
	if countPrijave(t, db, akcija.ID, users[0].ID) != 1 {
		t.Fatal("expected one prijava")
	}
	u := reloadUser(t, db, users[0].ID)
	if u.BrojPopeoSe != 1 {
		t.Fatalf("stats duplicated: %+v", u)
	}
}

func TestBulkAdd_ConcurrentWithSingleAdd(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 1)
	user := users[0]

	var wg sync.WaitGroup
	var bulkErr, singleErr error
	wg.Add(2)
	go func() {
		defer wg.Done()
		a := akcija
		_, bulkErr = BulkAddMembersToCompletedAction(db, &a, []uint{user.ID})
	}()
	go func() {
		defer wg.Done()
		a := akcija
		u := user
		_, singleErr = AddMemberToCompletedAction(db, &a, &u)
	}()
	wg.Wait()

	if bulkErr != nil && singleErr != nil {
		if !errors.Is(singleErr, ErrMemberAlreadySummited) {
			t.Fatalf("bulk=%v single=%v", bulkErr, singleErr)
		}
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 1 {
		t.Fatal("expected one prijava")
	}
	reloaded := reloadUser(t, db, user.ID)
	if reloaded.BrojPopeoSe != 1 {
		t.Fatalf("stats=%+v", reloaded)
	}
}

func TestBulkAdd_TwoDifferentMembersNoLostUpdate(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 2)

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			a := akcija
			u := users[idx]
			_, errs[idx] = AddMemberToCompletedAction(db, &a, &u)
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	for _, u0 := range users {
		u := reloadUser(t, db, u0.ID)
		if u.BrojPopeoSe != 1 || u.UkupnoKmKorisnik != 5 {
			t.Fatalf("lost update: %+v", u)
		}
	}
}

func TestBulkAdd_ActionNotCompleted(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 1)
	if err := db.Model(&akcija).Update("is_completed", false).Error; err != nil {
		t.Fatal(err)
	}
	akcija.IsCompleted = false

	_, err := BulkAddMembersToCompletedAction(db, &akcija, bulkIDs(users))
	if !errors.Is(err, ErrActionNotCompleted) {
		t.Fatalf("expected ErrActionNotCompleted, got %v", err)
	}
	if countPrijave(t, db, akcija.ID, users[0].ID) != 0 {
		t.Fatal("nothing should change")
	}
}

func TestBulkAdd_IgnoresMaxLjudiCapacity(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 3)
	if err := db.Model(&akcija).Update("max_ljudi", 1).Error; err != nil {
		t.Fatal(err)
	}

	res, err := BulkAddMembersToCompletedAction(db, &akcija, bulkIDs(users))
	if err != nil {
		t.Fatal(err)
	}
	if res.Added != 3 {
		t.Fatalf("completed history must not enforce maxLjudi, got %+v", res)
	}
}

func TestBulkAdd_IzboriFailureRollsBack(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 2)

	cbName := "bulk_fail_izbori_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:before_create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "prijava_izbori" {
			_ = tx.AddError(errors.New("forced izbori failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	_, err := BulkAddMembersToCompletedAction(db, &akcija, bulkIDs(users))
	if err == nil {
		t.Fatal("expected failure")
	}
	for _, u := range users {
		if countPrijave(t, db, akcija.ID, u.ID) != 0 {
			t.Fatal("batch must roll back")
		}
	}
}

func TestBulkAdd_NotificationsAfterCommitOnly(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 1)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: users[0].ID, Status: "popeo se"}).Error; err != nil {
		t.Fatal(err)
	}

	res, err := BulkAddMembersToCompletedAction(db, &akcija, bulkIDs(users))
	if err != nil {
		t.Fatal(err)
	}
	if res.Skipped != 1 || res.NewlySummited != 0 {
		t.Fatalf("expected skip, got %+v", res)
	}
	if countSummitNotifs(t, db, users[0].ID) != 0 {
		t.Fatal("no notification for skipped member")
	}
}

func TestBulkAdd_MatchesSingleFlowForPrijavljen(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 2)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: users[0].ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: users[1].ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	bulkRes, err := BulkAddMembersToCompletedAction(db, &akcija, []uint{users[0].ID})
	if err != nil {
		t.Fatal(err)
	}
	if bulkRes.Updated != 1 {
		t.Fatalf("bulk=%+v", bulkRes)
	}

	_, err = AddMemberToCompletedAction(db, &akcija, &users[1])
	if err != nil {
		t.Fatal(err)
	}
	var pBulk, pSingle models.Prijava
	db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, users[0].ID).First(&pBulk)
	db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, users[1].ID).First(&pSingle)
	if pBulk.Status != "popeo se" || pSingle.Status != "popeo se" {
		t.Fatalf("status bulk=%q single=%q", pBulk.Status, pSingle.Status)
	}
	if countIzbori(t, db, pBulk.ID) != 1 || countIzbori(t, db, pSingle.ID) != 1 {
		t.Fatal("both paths must ensure PrijavaIzbori")
	}
}

func TestBulkAdd_ConcurrentDifferentMembers(t *testing.T) {
	// MaxOpenConns(1): SQLite ne podržava pouzdano paralelne FOR UPDATE transakcije.
	db := testAddMemberDB(t, 1)
	akcija, users := seedBulkMembers(t, db, 4)

	var wg sync.WaitGroup
	var failCount atomic.Int32
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(batch int) {
			defer wg.Done()
			a := akcija
			ids := []uint{users[batch*2].ID, users[batch*2+1].ID}
			if _, err := BulkAddMembersToCompletedAction(db, &a, ids); err != nil {
				failCount.Add(1)
			}
		}(i)
	}
	wg.Wait()
	if failCount.Load() != 0 {
		t.Fatal("both bulk batches should succeed")
	}
	for _, u0 := range users {
		u := reloadUser(t, db, u0.ID)
		if u.BrojPopeoSe != 1 {
			t.Fatalf("lost update user %d: %+v", u0.ID, u)
		}
	}
}
