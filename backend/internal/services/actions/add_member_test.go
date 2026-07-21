package actions

import (
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testAddMemberDB(t *testing.T, maxOpen int) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
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
	if maxOpen < 1 {
		maxOpen = 1
	}
	sqlDB.SetMaxOpenConns(maxOpen)
	return db
}

func seedCompletedActionMember(t *testing.T, db *gorm.DB) (models.Akcija, models.Korisnik) {
	t.Helper()
	klubID := uint(1)
	akcija := models.Akcija{
		Naziv:                    "Test uspon",
		Datum:                    time.Now().Add(-24 * time.Hour),
		IsCompleted:              true,
		UkupnoKmAkcija:           10.5,
		UkupnoMetaraUsponaAkcija: 800,
		KlubID:                   &klubID,
	}
	user := models.Korisnik{
		Username: "member_" + t.Name(),
		Password: "x",
		Role:     "clan",
		KlubID:   &klubID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	return akcija, user
}

func reloadUser(t *testing.T, db *gorm.DB, id uint) models.Korisnik {
	t.Helper()
	var u models.Korisnik
	if err := db.First(&u, id).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func countPrijave(t *testing.T, db *gorm.DB, akcijaID, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, userID).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func countSummitNotifs(t *testing.T, db *gorm.DB, userID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Obavestenje{}).
		Where("user_id = ? AND type = ?", userID, models.ObavestenjeTipSummitReward).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func countIzbori(t *testing.T, db *gorm.DB, prijavaID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", prijavaID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func TestAddMember_NoPrijava_CreatesAndIncrementsStats(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)

	res, err := AddMemberToCompletedAction(db, &akcija, &user)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Prijava.Status != "popeo se" {
		t.Fatalf("status=%q", res.Prijava.Status)
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 1 {
		t.Fatal("expected one prijava")
	}
	if countIzbori(t, db, res.Prijava.ID) != 1 {
		t.Fatal("expected exactly one PrijavaIzbori")
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 1 || u.UkupnoKmKorisnik != 10.5 || u.UkupnoMetaraUsponaKorisnik != 800 {
		t.Fatalf("stats not incremented: %+v", u)
	}
	if countSummitNotifs(t, db, user.ID) != 1 {
		t.Fatal("expected summit notification after commit")
	}
}

func TestAddMember_FromPrijavljen_PromotesOnce(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	res, err := AddMemberToCompletedAction(db, &akcija, &user)
	if err != nil {
		t.Fatal(err)
	}
	var p models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, user.ID).First(&p).Error; err != nil {
		t.Fatal(err)
	}
	if p.Status != "popeo se" {
		t.Fatalf("status=%q", p.Status)
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 1 {
		t.Fatal("duplicate prijava")
	}
	if countIzbori(t, db, res.Prijava.ID) != 1 {
		t.Fatal("expected PrijavaIzbori after promote")
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 1 {
		t.Fatalf("BrojPopeoSe=%d", u.BrojPopeoSe)
	}
}

func TestAddMember_ExistingIzbori_NotDuplicated(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: "[1]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}

	res, err := AddMemberToCompletedAction(db, &akcija, &user)
	if err != nil {
		t.Fatal(err)
	}
	if countIzbori(t, db, res.Prijava.ID) != 1 {
		t.Fatal("must not duplicate PrijavaIzbori")
	}
	var izbor models.PrijavaIzbori
	if err := db.Where("prijava_id = ?", res.Prijava.ID).First(&izbor).Error; err != nil {
		t.Fatal(err)
	}
	if izbor.SelectedSmestajIDs != "[1]" {
		t.Fatalf("existing choices overwritten: %q", izbor.SelectedSmestajIDs)
	}
}

func TestAddMember_IzboriCreateFailure_RollsBack(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)

	cbName := "fail_izbori_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Create().Before("gorm:before_create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "prijava_izbori" {
			_ = tx.AddError(errors.New("forced izbori failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Create().Remove(cbName) })

	_, err := AddMemberToCompletedAction(db, &akcija, &user)
	if err == nil {
		t.Fatal("expected izbori failure")
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 0 {
		t.Fatal("prijava must roll back when izbori fail")
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 0 {
		t.Fatal("stats must roll back")
	}
}

func TestAddMember_FromNijeUspeo_PromotesOnce(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "nije uspeo"}).Error; err != nil {
		t.Fatal(err)
	}

	if _, err := AddMemberToCompletedAction(db, &akcija, &user); err != nil {
		t.Fatal(err)
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 1 {
		t.Fatal("expected single prijava")
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 1 || u.UkupnoKmKorisnik != 10.5 {
		t.Fatalf("stats=%+v", u)
	}
}

func TestAddMember_FromOtkazano_PromotesOnce(t *testing.T) {
	// Postojeća semantika: otkazano se tretira kao ne-summit i promovira u popeo se + statistika.
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "otkazano"}).Error; err != nil {
		t.Fatal(err)
	}

	if _, err := AddMemberToCompletedAction(db, &akcija, &user); err != nil {
		t.Fatal(err)
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 1 {
		t.Fatalf("BrojPopeoSe=%d", u.BrojPopeoSe)
	}
}

func TestAddMember_AlreadyPopeoSe_ConflictNoStats(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "popeo se"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&user).Updates(map[string]any{
		"broj_popeo_se": 3, "ukupno_km_korisnik": 50, "ukupno_metara_uspona_korisnik": 2000,
	}).Error; err != nil {
		t.Fatal(err)
	}

	_, err := AddMemberToCompletedAction(db, &akcija, &user)
	if !errors.Is(err, ErrMemberAlreadySummited) {
		t.Fatalf("expected ErrMemberAlreadySummited, got %v", err)
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 3 || u.UkupnoKmKorisnik != 50 || u.UkupnoMetaraUsponaKorisnik != 2000 {
		t.Fatalf("stats changed: %+v", u)
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 1 {
		t.Fatal("expected no new prijava")
	}
	if countSummitNotifs(t, db, user.ID) != 0 {
		t.Fatal("notification must not fire on conflict")
	}
}

func TestAddMember_StatsUpdateFailure_RollsBackPrijava(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)

	cbName := "fail_stats_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Update().Before("gorm:before_update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "korisnici" {
			_ = tx.AddError(errors.New("forced stats failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := AddMemberToCompletedAction(db, &akcija, &user)
	if err == nil {
		t.Fatal("expected stats failure")
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 0 {
		t.Fatal("prijava must roll back when stats fail")
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 0 || u.UkupnoKmKorisnik != 0 {
		t.Fatalf("stats must stay zero: %+v", u)
	}
	if countSummitNotifs(t, db, user.ID) != 0 {
		t.Fatal("no notification when tx fails")
	}
}

func TestAddMember_PrijavaSaveFailure_StatsUnchanged(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}

	cbName := "fail_prijava_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Update().Before("gorm:before_update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "prijave" {
			_ = tx.AddError(errors.New("forced prijava save failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	_, err := AddMemberToCompletedAction(db, &akcija, &user)
	if err == nil {
		t.Fatal("expected prijava failure")
	}
	var p models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, user.ID).First(&p).Error; err != nil {
		t.Fatal(err)
	}
	if p.Status != "prijavljen" {
		t.Fatalf("status should stay prijavljen, got %q", p.Status)
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 0 || u.UkupnoKmKorisnik != 0 {
		t.Fatalf("stats must stay unchanged: %+v", u)
	}
	if countSummitNotifs(t, db, user.ID) != 0 {
		t.Fatal("no notification when tx fails")
	}
}

func TestAddMember_ConcurrentSameUser_StatsOnce(t *testing.T) {
	// MaxOpenConns(1): SQLite ne podržava pouzdano paralelne FOR UPDATE transakcije;
	// serijalizacija i dalje provjerava unique + jednokratnu statistiku.
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)

	var wg sync.WaitGroup
	errs := make([]error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			u := user
			a := akcija
			_, errs[idx] = AddMemberToCompletedAction(db, &a, &u)
		}(i)
	}
	wg.Wait()

	successes := 0
	conflicts := 0
	for _, err := range errs {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrMemberAlreadySummited) {
			conflicts++
		} else {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if successes != 1 {
		t.Fatalf("expected 1 success, got %d (conflicts=%d errs=%v)", successes, conflicts, errs)
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 1 {
		t.Fatal("expected exactly one prijava")
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 1 || u.UkupnoKmKorisnik != 10.5 {
		t.Fatalf("stats duplicated: %+v", u)
	}
}

func TestAddMember_ConcurrentDifferentUsers_NoLostUpdate(t *testing.T) {
	// MaxOpenConns(1) izbjegava SQLite deadlock; redoslijed zaključavanja (akcija → korisnik)
	// na Postgres-u štiti paralelne update-e različitih korisnika.
	db := testAddMemberDB(t, 1)
	klubID := uint(7)
	akcija := models.Akcija{
		Naziv: "Multi", Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		UkupnoKmAkcija: 2, UkupnoMetaraUsponaAkcija: 100, KlubID: &klubID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	users := make([]models.Korisnik, 4)
	for i := range users {
		users[i] = models.Korisnik{
			Username: "u" + t.Name() + string(rune('a'+i)),
			Password: "x", Role: "clan", KlubID: &klubID,
		}
		if err := db.Create(&users[i]).Error; err != nil {
			t.Fatal(err)
		}
	}

	var wg sync.WaitGroup
	var failCount atomic.Int32
	for i := range users {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			u := users[idx]
			a := akcija
			if _, err := AddMemberToCompletedAction(db, &a, &u); err != nil {
				failCount.Add(1)
				t.Errorf("user %d: %v", idx, err)
			}
		}(i)
	}
	wg.Wait()
	if failCount.Load() != 0 {
		t.Fatalf("some users failed")
	}
	for _, u0 := range users {
		u := reloadUser(t, db, u0.ID)
		if u.BrojPopeoSe != 1 || u.UkupnoKmKorisnik != 2 || u.UkupnoMetaraUsponaKorisnik != 100 {
			t.Fatalf("lost update for user %d: %+v", u0.ID, u)
		}
		if countPrijave(t, db, akcija.ID, u0.ID) != 1 {
			t.Fatalf("prijava missing for %d", u0.ID)
		}
	}
}

func TestAddMember_ActionNotCompleted_NoChange(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	if err := db.Model(&akcija).Update("is_completed", false).Error; err != nil {
		t.Fatal(err)
	}
	akcija.IsCompleted = false

	_, err := AddMemberToCompletedAction(db, &akcija, &user)
	if !errors.Is(err, ErrActionNotCompleted) {
		t.Fatalf("expected ErrActionNotCompleted, got %v", err)
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 0 {
		t.Fatal("no prijava expected")
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 0 {
		t.Fatal("stats must not change")
	}
}

func TestAddMember_WrongClub_NoChange(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	other := uint(99)
	user.KlubID = &other
	if err := db.Model(&user).Update("klub_id", other).Error; err != nil {
		t.Fatal(err)
	}

	_, err := AddMemberToCompletedAction(db, &akcija, &user)
	if !errors.Is(err, ErrMemberNotInClub) {
		t.Fatalf("expected ErrMemberNotInClub, got %v", err)
	}
	if countPrijave(t, db, akcija.ID, user.ID) != 0 {
		t.Fatal("no prijava expected")
	}
}

func TestAddMember_IdempotentSecondCall_NoDoubleStats(t *testing.T) {
	db := testAddMemberDB(t, 1)
	akcija, user := seedCompletedActionMember(t, db)
	if _, err := AddMemberToCompletedAction(db, &akcija, &user); err != nil {
		t.Fatal(err)
	}
	_, err := AddMemberToCompletedAction(db, &akcija, &user)
	if !errors.Is(err, ErrMemberAlreadySummited) {
		t.Fatalf("expected conflict, got %v", err)
	}
	u := reloadUser(t, db, user.ID)
	if u.BrojPopeoSe != 1 {
		t.Fatalf("BrojPopeoSe=%d", u.BrojPopeoSe)
	}
	if countSummitNotifs(t, db, user.ID) != 1 {
		t.Fatalf("expected one notification, got %d", countSummitNotifs(t, db, user.ID))
	}
}
