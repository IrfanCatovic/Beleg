package handlers

import (
	"errors"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testGuidePrijavaDB(t *testing.T) *gorm.DB {
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
		&models.AkcijaSmestaj{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("create prijava indexes: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db handle: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func seedGuideUsers(t *testing.T, db *gorm.DB) (guide1, guide2 models.Korisnik) {
	t.Helper()
	guide1 = models.Korisnik{Username: "guide1", Password: "x", Role: "vodic"}
	guide2 = models.Korisnik{Username: "guide2", Password: "x", Role: "vodic"}
	if err := db.Create(&guide1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide2).Error; err != nil {
		t.Fatal(err)
	}
	return guide1, guide2
}

func createAkcijaWithGuideTx(t *testing.T, tx *gorm.DB, guideID uint, maxLjudi int) models.Akcija {
	t.Helper()
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{
		Naziv:          "Tour",
		Datum:          future,
		VodicID:        guideID,
		OrganizatorTip: "vodic",
		MaxLjudi:       maxLjudi,
	}
	if err := tx.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := EnsureGuidePrijava(tx, akcija.ID, guideID); err != nil {
		t.Fatal(err)
	}
	return akcija
}

func countActivePrijave(t *testing.T, db *gorm.DB, akcijaID uint) int64 {
	t.Helper()
	n, err := helpers.CountActivePrijaveForAkcija(db, akcijaID)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func TestEnsureGuidePrijava_CreateActionWithGuide(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, _ := seedGuideUsers(t, db)

	var akcija models.Akcija
	if err := db.Transaction(func(tx *gorm.DB) error {
		akcija = createAkcijaWithGuideTx(t, tx, guide1.ID, 10)
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	var prijave []models.Prijava
	if err := db.Where("akcija_id = ?", akcija.ID).Find(&prijave).Error; err != nil {
		t.Fatal(err)
	}
	if len(prijave) != 1 {
		t.Fatalf("expected 1 prijava, got %d", len(prijave))
	}
	if prijave[0].KorisnikID != guide1.ID || prijave[0].Status != "prijavljen" {
		t.Fatalf("unexpected prijava: %+v", prijave[0])
	}
	var izbori int64
	db.Model(&models.PrijavaIzbori{}).Where("prijava_id = ?", prijave[0].ID).Count(&izbori)
	if izbori != 1 {
		t.Fatalf("expected PrijavaIzbori row, got %d", izbori)
	}
}

// TestEnsureGuidePrijava_PastDeadlineAllowsGuideAuto documents:
// istekao rok prijave (datum/start) != završena akcija.
// Guide-auto može dodati vodiča; member-signup ne može.
func TestEnsureGuidePrijava_PastDeadlineAllowsGuideAuto(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, _ := seedGuideUsers(t, db)
	member := models.Korisnik{Username: "memberx", Password: "x", Role: "clan"}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}

	pastStart := time.Now().Add(-2 * time.Hour)
	akcija := models.Akcija{
		Naziv: "Past deadline", Datum: time.Now().Add(24 * time.Hour),
		StartAt: &pastStart, VodicID: guide1.ID, MaxLjudi: 5, IsCompleted: false,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureGuidePrijava(tx, akcija.ID, guide1.ID)
	}); err != nil {
		t.Fatalf("guide-auto should allow signup after member deadline: %v", err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_, err := helpers.CreateConfirmedPrijavaTx(tx, akcija.ID, member.ID, time.Now(), helpers.ConfirmedPrijavaPolicyMemberSignup)
		return err
	})
	if !errors.Is(err, helpers.ErrSignupClosed) {
		t.Fatalf("member-signup should be blocked after deadline, got %v", err)
	}
}

func TestEnsureGuidePrijava_CompletedActionRejectsNewGuide(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, guide2 := seedGuideUsers(t, db)

	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{
		Naziv: "Done", Datum: future, VodicID: guide1.ID, MaxLjudi: 5, IsCompleted: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{
		AkcijaID: akcija.ID, KorisnikID: guide1.ID, Status: "prijavljen",
	}).Error; err != nil {
		t.Fatal(err)
	}

	origVodic := akcija.VodicID
	err := db.Transaction(func(tx *gorm.DB) error {
		akcija.VodicID = guide2.ID
		if err := tx.Save(&akcija).Error; err != nil {
			return err
		}
		return EnsureGuidePrijava(tx, akcija.ID, guide2.ID)
	})
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected ErrAkcijaAlreadyComplete for new guide on completed action, got %v", err)
	}

	var reloaded models.Akcija
	if err := db.First(&reloaded, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.VodicID != origVodic {
		t.Fatalf("expected vodic rollback to %d, got %d", origVodic, reloaded.VodicID)
	}
	var guide2Count int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide2.ID).Count(&guide2Count)
	if guide2Count != 0 {
		t.Fatal("expected no prijava for new guide on completed action")
	}
}

func TestEnsureGuidePrijava_CompletedActionExistingGuideIdempotent(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, _ := seedGuideUsers(t, db)

	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{
		Naziv: "Done", Datum: future, VodicID: guide1.ID, MaxLjudi: 5, IsCompleted: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	existing := models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide1.ID, Status: "prijavljen"}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureGuidePrijava(tx, akcija.ID, guide1.ID)
	}); err != nil {
		t.Fatalf("idempotent ensure for existing guide on completed action should succeed: %v", err)
	}

	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide1.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected exactly one prijava unchanged, got %d", n)
	}
}

func TestEnsureGuidePrijava_IdempotentWhenPrijavaExists(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, _ := seedGuideUsers(t, db)

	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Tour", Datum: future, VodicID: guide1.ID, MaxLjudi: 5}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	existing := models.Prijava{AkcijaID: akcija.ID, KorisnikID: guide1.ID, Status: "prijavljen"}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureGuidePrijava(tx, akcija.ID, guide1.ID)
	}); err != nil {
		t.Fatalf("expected idempotent success, got %v", err)
	}

	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide1.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected no duplicate prijava, count=%d", n)
	}
}

func TestEnsureGuidePrijava_MaxLjudiOneGuideTakesSlot(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, _ := seedGuideUsers(t, db)

	var akcija models.Akcija
	if err := db.Transaction(func(tx *gorm.DB) error {
		akcija = createAkcijaWithGuideTx(t, tx, guide1.ID, 1)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if n := countActivePrijave(t, db, akcija.ID); n != 1 {
		t.Fatalf("expected guide to occupy the only slot, active=%d", n)
	}
}

func TestEnsureGuidePrijava_FullCapacityNewGuideRollsBack(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, guide2 := seedGuideUsers(t, db)

	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Full", Datum: future, VodicID: guide1.ID, MaxLjudi: 1}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureGuidePrijava(tx, akcija.ID, guide1.ID)
	}); err != nil {
		t.Fatal(err)
	}

	origVodic := akcija.VodicID
	err := db.Transaction(func(tx *gorm.DB) error {
		akcija.VodicID = guide2.ID
		if err := tx.Save(&akcija).Error; err != nil {
			return err
		}
		return EnsureGuidePrijava(tx, akcija.ID, guide2.ID)
	})
	if !errors.Is(err, helpers.ErrAkcijaCapacityFull) {
		t.Fatalf("expected ErrAkcijaCapacityFull, got %v", err)
	}

	var reloaded models.Akcija
	if err := db.First(&reloaded, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.VodicID != origVodic {
		t.Fatalf("expected vodic rollback to guide1, got %d", reloaded.VodicID)
	}
	var guide2Count int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide2.ID).Count(&guide2Count)
	if guide2Count != 0 {
		t.Fatal("expected no prijava for new guide after rollback")
	}
}

func TestEnsureGuidePrijava_InvalidGuideUserRollsBack(t *testing.T) {
	db := testGuidePrijavaDB(t)
	deleted := models.Korisnik{Username: "gone", Password: "x", Role: "deleted"}
	if err := db.Create(&deleted).Error; err != nil {
		t.Fatal(err)
	}

	var akcijaID uint
	err := db.Transaction(func(tx *gorm.DB) error {
		future := time.Now().Add(72 * time.Hour)
		akcija := models.Akcija{Naziv: "Bad guide", Datum: future, VodicID: deleted.ID, MaxLjudi: 5}
		if err := tx.Create(&akcija).Error; err != nil {
			return err
		}
		akcijaID = akcija.ID
		return EnsureGuidePrijava(tx, akcija.ID, deleted.ID)
	})
	if !errors.Is(err, helpers.ErrKorisnikNotEligible) {
		t.Fatalf("expected ErrKorisnikNotEligible, got %v", err)
	}

	var count int64
	db.Model(&models.Akcija{}).Where("id = ?", akcijaID).Count(&count)
	if count != 0 {
		t.Fatal("expected akcija rolled back when guide invalid")
	}
}

func TestEnsureGuidePrijava_FailureRollsBackNestedAndAkcija(t *testing.T) {
	db := testGuidePrijavaDB(t)
	deleted := models.Korisnik{Username: "gone2", Password: "x", Role: "deleted"}
	if err := db.Create(&deleted).Error; err != nil {
		t.Fatal(err)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		future := time.Now().Add(72 * time.Hour)
		akcija := models.Akcija{Naziv: "Nested rollback", Datum: future, VodicID: deleted.ID, MaxLjudi: 5}
		if err := tx.Create(&akcija).Error; err != nil {
			return err
		}
		smestaj := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "Hotel", CenaPoOsobiUkupno: 20}
		if err := tx.Create(&smestaj).Error; err != nil {
			return err
		}
		return EnsureGuidePrijava(tx, akcija.ID, deleted.ID)
	})
	if !errors.Is(err, helpers.ErrKorisnikNotEligible) {
		t.Fatalf("expected ErrKorisnikNotEligible, got %v", err)
	}

	var akcije, smestaji int64
	db.Model(&models.Akcija{}).Count(&akcije)
	db.Model(&models.AkcijaSmestaj{}).Count(&smestaji)
	if akcije != 0 || smestaji != 0 {
		t.Fatalf("expected rollback of akcija and nested data, akcije=%d smestaji=%d", akcije, smestaji)
	}
}

func TestEnsureGuidePrijava_ConcurrentSinglePrijava(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, _ := seedGuideUsers(t, db)
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Race", Datum: future, VodicID: guide1.ID, MaxLjudi: 10}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			errs[idx] = db.Transaction(func(tx *gorm.DB) error {
				return EnsureGuidePrijava(tx, akcija.ID, guide1.ID)
			})
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatalf("concurrent EnsureGuidePrijava failed: %v", err)
		}
	}
	var n int64
	db.Model(&models.Prijava{}).Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, guide1.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected exactly one prijava, got %d", n)
	}
}

// TestEnsureGuidePrijava_GuideChangeKeepsOldParticipant documents existing behavior:
// promjena vodiča samo dodaje prijavu novom vodiču; stari vodič ostaje učesnik ako već ima prijavu.
func TestEnsureGuidePrijava_GuideChangeKeepsOldParticipant(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, guide2 := seedGuideUsers(t, db)

	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Change", Datum: future, VodicID: guide1.ID, MaxLjudi: 5}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureGuidePrijava(tx, akcija.ID, guide1.ID)
	}); err != nil {
		t.Fatal(err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		akcija.VodicID = guide2.ID
		if err := tx.Save(&akcija).Error; err != nil {
			return err
		}
		return EnsureGuidePrijava(tx, akcija.ID, guide2.ID)
	}); err != nil {
		t.Fatalf("guide change accept: %v", err)
	}

	var reloaded models.Akcija
	if err := db.First(&reloaded, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.VodicID != guide2.ID {
		t.Fatalf("expected new vodic %d, got %d", guide2.ID, reloaded.VodicID)
	}

	var prijave []models.Prijava
	if err := db.Where("akcija_id = ?", akcija.ID).Order("korisnik_id").Find(&prijave).Error; err != nil {
		t.Fatal(err)
	}
	if len(prijave) != 2 {
		t.Fatalf("expected prijave for both guides, got %d", len(prijave))
	}
	if prijave[0].KorisnikID != guide1.ID || prijave[1].KorisnikID != guide2.ID {
		t.Fatalf("expected old guide to remain participant: %+v", prijave)
	}
}

// TestEnsureGuidePrijava_MaxLjudiZeroUnlimited documents maxLjudi=0 as unlimited capacity.
func TestEnsureGuidePrijava_MaxLjudiZeroUnlimited(t *testing.T) {
	db := testGuidePrijavaDB(t)
	guide1, _ := seedGuideUsers(t, db)

	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Unlimited", Datum: future, VodicID: guide1.ID, MaxLjudi: 0}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 5; i++ {
		u := models.Korisnik{Username: "member" + strconv.Itoa(i), Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.Prijava{AkcijaID: akcija.ID, KorisnikID: u.ID, Status: "prijavljen"}).Error; err != nil {
			t.Fatal(err)
		}
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return EnsureGuidePrijava(tx, akcija.ID, guide1.ID)
	}); err != nil {
		t.Fatalf("maxLjudi=0 should not block guide auto signup: %v", err)
	}
	if n := countActivePrijave(t, db, akcija.ID); n != 6 {
		t.Fatalf("expected 5 members + guide = 6 active prijave, got %d", n)
	}
}
