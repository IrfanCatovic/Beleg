package guidebooking

import (
	"errors"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type ferrataAcceptFixture struct {
	db        *gorm.DB
	ferrata   models.Ferrata
	requester models.Korisnik
	guide     models.Korisnik
	akcija    models.Akcija
	booking   models.FerrataGuideBookingRequest
	target    models.FerrataGuideBookingTarget
}

func testGuideBookingDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.Ferrata{},
		&models.FerrataGuideBookingRequest{},
		&models.FerrataGuideBookingTarget{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("create prijava indexes: %v", err)
	}
	return db
}

func setupFerrataAcceptFixture(t *testing.T, mutate func(*ferrataAcceptFixture)) *ferrataAcceptFixture {
	t.Helper()
	db := testGuideBookingDB(t)

	ferrata := models.Ferrata{Naziv: "Test Ferrata", Slug: "test-ferrata"}
	if err := db.Create(&ferrata).Error; err != nil {
		t.Fatal(err)
	}

	requester := models.Korisnik{Username: "requester", Password: "x", Role: "clan"}
	guide := models.Korisnik{Username: "guide", Password: "x", Role: "vodic"}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&guide).Error; err != nil {
		t.Fatal(err)
	}

	future := time.Now().Add(48 * time.Hour)
	akcija := models.Akcija{
		Naziv:          "Via ferrata tour",
		Datum:          future,
		TipAkcije:      "via_ferrata",
		FerrataID:      &ferrata.ID,
		OrganizatorTip: "vodic",
		VodicID:        guide.ID,
		MaxLjudi:       10,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	booking := models.FerrataGuideBookingRequest{
		FerrataID:       ferrata.ID,
		RequesterID:     requester.ID,
		DesiredDate:     future,
		TimeOfDay:       "morning",
		NumberOfPeople:  2,
		GroupExperience: "mixed",
		EquipmentStatus: "complete",
		ContactPhone:    "+381601234567",
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}

	target := models.FerrataGuideBookingTarget{
		BookingRequestID: booking.ID,
		GuideProfileID:   1,
		GuideUserID:      guide.ID,
		Status:           models.GuideBookingTargetStatusPending,
	}
	if err := db.Create(&target).Error; err != nil {
		t.Fatal(err)
	}

	f := &ferrataAcceptFixture{
		db: db, ferrata: ferrata, requester: requester, guide: guide,
		akcija: akcija, booking: booking, target: target,
	}
	if mutate != nil {
		mutate(f)
	}
	return f
}

func countPrijave(t *testing.T, db *gorm.DB, akcijaID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Prijava{}).Where("akcija_id = ?", akcijaID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func reloadTarget(t *testing.T, db *gorm.DB, id uint) models.FerrataGuideBookingTarget {
	t.Helper()
	var target models.FerrataGuideBookingTarget
	if err := db.First(&target, id).Error; err != nil {
		t.Fatal(err)
	}
	return target
}

func TestAcceptFerrata_CreatesConfirmedPrijave(t *testing.T) {
	f := setupFerrataAcceptFixture(t, nil)

	result, conflict, err := AcceptFerrata(f.db, f.booking.ID, &f.guide, f.akcija.ID)
	if err != nil {
		t.Fatalf("AcceptFerrata: %v", err)
	}
	if conflict != nil {
		t.Fatal("expected no conflict")
	}
	if result == nil || result.Booking == nil {
		t.Fatal("expected booking result")
	}

	target := reloadTarget(t, f.db, f.target.ID)
	if target.Status != models.GuideBookingTargetStatusAccepted {
		t.Fatalf("expected accepted target, got %q", target.Status)
	}
	if target.ActionID == nil || *target.ActionID != f.akcija.ID {
		t.Fatal("expected action linked on target")
	}

	var prijave []models.Prijava
	if err := f.db.Where("akcija_id = ?", f.akcija.ID).Find(&prijave).Error; err != nil {
		t.Fatal(err)
	}
	if len(prijave) != 2 {
		t.Fatalf("expected 2 prijave (requester + guide), got %d", len(prijave))
	}
	seen := map[uint]bool{}
	for _, p := range prijave {
		if p.Status != "prijavljen" {
			t.Fatalf("expected confirmed status, got %q", p.Status)
		}
		seen[p.KorisnikID] = true
	}
	if !seen[f.requester.ID] || !seen[f.guide.ID] {
		t.Fatal("expected prijave for requester and guide")
	}
}

func TestAcceptFerrata_ExistingPrijavaIsIdempotent(t *testing.T) {
	f := setupFerrataAcceptFixture(t, func(fx *ferrataAcceptFixture) {
		existing := models.Prijava{
			AkcijaID: fx.akcija.ID, KorisnikID: fx.requester.ID, Status: "prijavljen",
		}
		if err := fx.db.Create(&existing).Error; err != nil {
			t.Fatal(err)
		}
	})

	result, conflict, err := AcceptFerrata(f.db, f.booking.ID, &f.guide, f.akcija.ID)
	if err != nil {
		t.Fatalf("expected success when prijava exists, got %v", err)
	}
	if conflict != nil {
		t.Fatal("expected no conflict")
	}
	if result == nil {
		t.Fatal("expected result")
	}

	if n := countPrijave(t, f.db, f.akcija.ID); n != 2 {
		t.Fatalf("expected exactly 2 prijave (existing requester + new guide), got %d", n)
	}
	var dup int64
	f.db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", f.akcija.ID, f.requester.ID).
		Count(&dup)
	if dup != 1 {
		t.Fatalf("expected no duplicate requester prijava, count=%d", dup)
	}
}

func TestAcceptFerrata_FullCapacityRollsBack(t *testing.T) {
	f := setupFerrataAcceptFixture(t, func(fx *ferrataAcceptFixture) {
		fx.akcija.MaxLjudi = 2
		if err := fx.db.Model(&fx.akcija).Update("max_ljudi", 2).Error; err != nil {
			t.Fatal(err)
		}
		// Guide already consumes one slot (typical EnsureGuidePrijava path on action create).
		if err := fx.db.Create(&models.Prijava{
			AkcijaID: fx.akcija.ID, KorisnikID: fx.guide.ID, Status: "prijavljen",
		}).Error; err != nil {
			t.Fatal(err)
		}
		// Second slot filled — requester cannot be added.
		if err := fx.db.Create(&models.Prijava{
			AkcijaID: fx.akcija.ID, KorisnikID: 999, Status: "prijavljen",
		}).Error; err != nil {
			t.Fatal(err)
		}
	})

	_, _, err := AcceptFerrata(f.db, f.booking.ID, &f.guide, f.akcija.ID)
	if !errors.Is(err, helpers.ErrAkcijaCapacityFull) {
		t.Fatalf("expected ErrAkcijaCapacityFull, got %v", err)
	}

	target := reloadTarget(t, f.db, f.target.ID)
	if target.Status != models.GuideBookingTargetStatusPending {
		t.Fatalf("expected booking target unchanged (pending), got %q", target.Status)
	}
	if n := countPrijave(t, f.db, f.akcija.ID); n != 2 {
		t.Fatalf("expected no new prijave after rollback, got %d", n)
	}
}

func TestAcceptFerrata_CompletedActionRollsBack(t *testing.T) {
	f := setupFerrataAcceptFixture(t, func(fx *ferrataAcceptFixture) {
		if err := fx.db.Model(&fx.akcija).Update("is_completed", true).Error; err != nil {
			t.Fatal(err)
		}
		fx.akcija.IsCompleted = true
	})

	_, _, err := AcceptFerrata(f.db, f.booking.ID, &f.guide, f.akcija.ID)
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected ErrAkcijaAlreadyComplete, got %v", err)
	}

	target := reloadTarget(t, f.db, f.target.ID)
	if target.Status != models.GuideBookingTargetStatusPending {
		t.Fatalf("expected target still pending, got %q", target.Status)
	}
	if n := countPrijave(t, f.db, f.akcija.ID); n != 0 {
		t.Fatalf("expected no prijave, got %d", n)
	}
}

func TestAcceptFerrata_ConcurrentAcceptSingleOutcome(t *testing.T) {
	f := setupFerrataAcceptFixture(t, nil)

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, _, err := AcceptFerrata(f.db, f.booking.ID, &f.guide, f.akcija.ID)
			errs[idx] = err
		}(i)
	}
	wg.Wait()

	successes := 0
	for _, err := range errs {
		if err == nil {
			successes++
		}
	}
	if successes != 1 {
		t.Fatalf("expected exactly one successful accept, got %d successes (errs=%v)", successes, errs)
	}

	if n := countPrijave(t, f.db, f.akcija.ID); n != 2 {
		t.Fatalf("expected at most one accept creating 2 prijave, got %d prijave", n)
	}
}

func TestAcceptFerrata_FailureMidFlowRollsBack(t *testing.T) {
	f := setupFerrataAcceptFixture(t, func(fx *ferrataAcceptFixture) {
		if err := fx.db.Model(&fx.guide).Update("role", "deleted").Error; err != nil {
			t.Fatal(err)
		}
		fx.guide.Role = "deleted"
	})

	_, _, err := AcceptFerrata(f.db, f.booking.ID, &f.guide, f.akcija.ID)
	if !errors.Is(err, helpers.ErrKorisnikNotEligible) {
		t.Fatalf("expected ErrKorisnikNotEligible, got %v", err)
	}

	target := reloadTarget(t, f.db, f.target.ID)
	if target.Status != models.GuideBookingTargetStatusPending {
		t.Fatalf("expected target still pending, got %q", target.Status)
	}
	if n := countPrijave(t, f.db, f.akcija.ID); n != 0 {
		t.Fatalf("expected no prijave after rollback, got %d", n)
	}
}

// TestAcceptFerrata_GuideCountsTowardCapacity documents that vodič troši kapacitet kao aktivna prijava
// (status "prijavljen" ulazi u helpers.PrijavaActiveStatuses), osim kada već postoji prijava (idempotentno).
func TestAcceptFerrata_GuideCountsTowardCapacity(t *testing.T) {
	f := setupFerrataAcceptFixture(t, func(fx *ferrataAcceptFixture) {
		fx.akcija.MaxLjudi = 1
		if err := fx.db.Model(&fx.akcija).Update("max_ljudi", 1).Error; err != nil {
			t.Fatal(err)
		}
	})

	// Requester fills the only slot; guide signup would need a second slot → rollback.
	_, _, err := AcceptFerrata(f.db, f.booking.ID, &f.guide, f.akcija.ID)
	if !errors.Is(err, helpers.ErrAkcijaCapacityFull) {
		t.Fatalf("expected capacity error when max=1 and both requester+guide need slots, got %v", err)
	}
	if n := countPrijave(t, f.db, f.akcija.ID); n != 0 {
		t.Fatalf("expected rollback with zero prijave, got %d", n)
	}

	// When guide already has prijava, requester can take the remaining slot (max=2).
	f2 := setupFerrataAcceptFixture(t, func(fx *ferrataAcceptFixture) {
		fx.akcija.MaxLjudi = 2
		if err := fx.db.Model(&fx.akcija).Update("max_ljudi", 2).Error; err != nil {
			t.Fatal(err)
		}
		if err := fx.db.Create(&models.Prijava{
			AkcijaID: fx.akcija.ID, KorisnikID: fx.guide.ID, Status: "prijavljen",
		}).Error; err != nil {
			t.Fatal(err)
		}
	})
	result, conflict, err := AcceptFerrata(f2.db, f2.booking.ID, &f2.guide, f2.akcija.ID)
	if err != nil {
		t.Fatalf("expected success when guide already registered and one slot remains, got %v", err)
	}
	if conflict != nil || result == nil {
		t.Fatal("expected successful accept")
	}
	if n := countPrijave(t, f2.db, f2.akcija.ID); n != 2 {
		t.Fatalf("expected guide existing + requester new = 2 prijave, got %d", n)
	}

	// max=1 with guide already registered leaves no room for requester.
	f3 := setupFerrataAcceptFixture(t, func(fx *ferrataAcceptFixture) {
		fx.akcija.MaxLjudi = 1
		if err := fx.db.Model(&fx.akcija).Update("max_ljudi", 1).Error; err != nil {
			t.Fatal(err)
		}
		if err := fx.db.Create(&models.Prijava{
			AkcijaID: fx.akcija.ID, KorisnikID: fx.guide.ID, Status: "prijavljen",
		}).Error; err != nil {
			t.Fatal(err)
		}
	})
	_, _, err = AcceptFerrata(f3.db, f3.booking.ID, &f3.guide, f3.akcija.ID)
	if !errors.Is(err, helpers.ErrAkcijaCapacityFull) {
		t.Fatalf("expected capacity error when guide already fills max=1, got %v", err)
	}
}
