package handlers

import (
	"encoding/json"
	"errors"
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

func testUpdateAkcijaDB(t *testing.T) *gorm.DB {
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
		&models.AkcijaPrevoz{},
		&models.AkcijaOprema{},
		&models.AkcijaOpremaRent{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}

func seedAkcijaFinancialBase(t *testing.T, db *gorm.DB, completed bool) models.Akcija {
	t.Helper()
	akcija := models.Akcija{
		Naziv:       "Fin test",
		Planina:     "Test",
		Vrh:         "Vrh",
		Datum:       time.Now().Add(48 * time.Hour),
		Tezina:      "srednje",
		MaxLjudi:    10,
		Javna:       true,
		CenaClan:    30,
		CenaOstali:  40,
		IsCompleted: completed,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	return akcija
}

func seedNestedFinancialOptions(t *testing.T, db *gorm.DB, akcijaID uint) (models.AkcijaSmestaj, models.AkcijaPrevoz, models.AkcijaOpremaRent) {
	t.Helper()
	smestaj := models.AkcijaSmestaj{AkcijaID: akcijaID, Naziv: "Hotel A", CenaPoOsobiUkupno: 30}
	prevoz := models.AkcijaPrevoz{AkcijaID: akcijaID, TipPrevoza: "autobus", NazivGrupe: "Grupa 1", Kapacitet: 10, CenaPoOsobi: 15}
	oprema := models.AkcijaOprema{AkcijaID: akcijaID, Naziv: "Štap", Obavezna: true}
	if err := db.Create(&smestaj).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&prevoz).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&oprema).Error; err != nil {
		t.Fatal(err)
	}
	rent := models.AkcijaOpremaRent{
		AkcijaID: akcijaID, AkcijaOpremaID: &oprema.ID,
		NazivOpreme: "Štap", DostupnaKolicina: 5, CenaPoSetu: 10,
	}
	if err := db.Create(&rent).Error; err != nil {
		t.Fatal(err)
	}
	return smestaj, prevoz, rent
}

func runExecuteUpdateAkcijaTx(t *testing.T, db *gorm.DB, akcija models.Akcija, nested ActionNestedSyncInput) error {
	t.Helper()
	return db.Transaction(func(tx *gorm.DB) error {
		return executeUpdateAkcijaTx(tx, akcija, nested)
	})
}

func reloadAkcijaCenaClan(t *testing.T, db *gorm.DB, id uint) float64 {
	t.Helper()
	var a models.Akcija
	if err := db.First(&a, id).Error; err != nil {
		t.Fatal(err)
	}
	return a.CenaClan
}

func assertCompletedFinancialError(t *testing.T, err error) {
	t.Helper()
	if !errors.Is(err, helpers.ErrCompletedActionFinancialsImmutable) {
		t.Fatalf("expected ErrCompletedActionFinancialsImmutable, got %v", err)
	}
}

func TestCompletedAction_CenaClanChangeRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	akcija.CenaClan = 50
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{})
	assertCompletedFinancialError(t, err)
	if reloadAkcijaCenaClan(t, db, akcija.ID) != 30 {
		t.Fatal("expected old CenaClan preserved")
	}
}

func TestCompletedAction_CenaOstaliChangeRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	akcija.CenaOstali = 55
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{})
	assertCompletedFinancialError(t, err)
}

func TestCompletedAction_JavnaChangeRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	akcija.Javna = false
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{})
	assertCompletedFinancialError(t, err)
}

func TestCompletedAction_SmestajPriceChangeRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	smestaj, _, _ := seedNestedFinancialOptions(t, db, akcija.ID)
	updated := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":50,"opis":""}]`
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &updated})
	assertCompletedFinancialError(t, err)
	var row models.AkcijaSmestaj
	if err := db.First(&row, smestaj.ID).Error; err != nil {
		t.Fatal(err)
	}
	if row.CenaPoOsobiUkupno != 30 {
		t.Fatalf("expected nested price rollback, got %v", row.CenaPoOsobiUkupno)
	}
}

func TestCompletedAction_PrevozPriceChangeRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	_, prevoz, _ := seedNestedFinancialOptions(t, db, akcija.ID)
	updated := `[{"tipPrevoza":"autobus","nazivGrupe":"Grupa 1","kapacitet":10,"cenaPoOsobi":25}]`
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Prevoz: &updated})
	assertCompletedFinancialError(t, err)
	var row models.AkcijaPrevoz
	if err := db.First(&row, prevoz.ID).Error; err != nil {
		t.Fatal(err)
	}
	if row.CenaPoOsobi != 15 {
		t.Fatalf("expected prevoz price preserved, got %v", row.CenaPoOsobi)
	}
}

func TestCompletedAction_RentPriceChangeRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	_, _, rent := seedNestedFinancialOptions(t, db, akcija.ID)
	updated := `[{"naziv":"Štap","dostupnaKolicina":5,"cenaPoSetu":20}]`
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Oprema: &updated})
	assertCompletedFinancialError(t, err)
	var row models.AkcijaOpremaRent
	if err := db.First(&row, rent.ID).Error; err != nil {
		t.Fatal(err)
	}
	if row.CenaPoSetu != 10 {
		t.Fatalf("expected rent price preserved, got %v", row.CenaPoSetu)
	}
}

func TestCompletedAction_AddFinancialOptionRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	seedNestedFinancialOptions(t, db, akcija.ID)
	added := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":30,"opis":""},{"naziv":"Hotel B","cenaPoOsobiUkupno":20,"opis":""}]`
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &added})
	assertCompletedFinancialError(t, err)
	var count int64
	if err := db.Model(&models.AkcijaSmestaj{}).Where("akcija_id = ? AND naziv = ?", akcija.ID, "Hotel B").Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("new smestaj row should not persist")
	}
}

func TestCompletedAction_RemoveFinancialOptionRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	seedNestedFinancialOptions(t, db, akcija.ID)
	empty := "[]"
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &empty})
	assertCompletedFinancialError(t, err)
	var count int64
	if err := db.Model(&models.AkcijaSmestaj{}).Where("akcija_id = ?", akcija.ID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected smestaj preserved, count=%d", count)
	}
}

func TestCompletedAction_VodicIDChangeRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	guide1 := seedUser(t, db, "guide1")
	guide2 := seedUser(t, db, "guide2")
	akcija := seedAkcijaFinancialBase(t, db, true)
	akcija.VodicID = guide1.ID
	if err := db.Save(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	akcija.VodicID = guide2.ID
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{})
	assertCompletedFinancialError(t, err)
	var saved models.Akcija
	if err := db.First(&saved, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.VodicID != guide1.ID {
		t.Fatalf("expected old vodic preserved, got %d", saved.VodicID)
	}
}

func TestCompletedAction_IdenticalFinancialPayloadAllowed(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	seedNestedFinancialOptions(t, db, akcija.ID)
	smestaj := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":30,"opis":""}]`
	prevoz := `[{"tipPrevoza":"autobus","nazivGrupe":"Grupa 1","kapacitet":10,"cenaPoOsobi":15}]`
	oprema := `[{"naziv":"Štap","dostupnaKolicina":5,"cenaPoSetu":10}]`
	akcija.Naziv = "Updated title only"
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &smestaj, Prevoz: &prevoz, Oprema: &oprema})
	if err != nil {
		t.Fatalf("expected success for identical financial payload, got %v", err)
	}
	var saved models.Akcija
	if err := db.First(&saved, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.Naziv != "Updated title only" {
		t.Fatal("expected non-financial field updated")
	}
}

func TestCompletedAction_NestedOrderDoesNotFalsePositive(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	seedNestedFinancialOptions(t, db, akcija.ID)
	reordered := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":30,"opis":""}]`
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &reordered})
	if err != nil {
		t.Fatalf("expected no false positive, got %v", err)
	}
}

func TestCompletedAction_NonFinancialChangeAllowed(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	akcija.Opis = "Novi opis završene akcije"
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{})
	if err != nil {
		t.Fatalf("expected non-financial update to pass, got %v", err)
	}
}

func TestActiveAction_BasePriceChangeAllowed(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	user := seedUser(t, db, "paid_user")
	akcija := seedAkcijaFinancialBase(t, db, false)
	p := seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true, "[]")
	akcija.CenaClan = 50
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatalf("active action price change should pass: %v", err)
	}
	if reloadAkcijaCenaClan(t, db, akcija.ID) != 50 {
		t.Fatal("expected new price saved")
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must reset when financial snapshot changes")
	}
}

func TestActiveAction_NestedPriceChangeAllowed(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	smestaj, _, _ := seedNestedFinancialOptions(t, db, akcija.ID)
	updated := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":75,"opis":""}]`
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &updated}); err != nil {
		t.Fatalf("active nested price change should pass: %v", err)
	}
	var row models.AkcijaSmestaj
	if err := db.First(&row, smestaj.ID).Error; err != nil {
		t.Fatal(err)
	}
	if row.CenaPoOsobiUkupno != 75 {
		t.Fatalf("expected updated price 75, got %v", row.CenaPoOsobiUkupno)
	}
}

func TestCompletedAction_NestedSyncErrorRollsBackBaseChange(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	smestaj, _, _ := seedNestedFinancialOptions(t, db, akcija.ID)
	user := seedUser(t, db, "member_sm")
	prijava := models.Prijava{AkcijaID: akcija.ID, KorisnikID: user.ID, Status: "prijavljen"}
	if err := db.Create(&prijava).Error; err != nil {
		t.Fatal(err)
	}
	smestajJSON, _ := json.Marshal([]uint{smestaj.ID})
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: prijava.ID, SelectedSmestajIDs: string(smestajJSON), SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}
	empty := "[]"
	akcija.Naziv = "Should rollback"
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &empty})
	if !errors.Is(err, ErrNestedOptionInUse) {
		t.Fatalf("expected ErrNestedOptionInUse, got %v", err)
	}
	var saved models.Akcija
	if err := db.First(&saved, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.Naziv == "Should rollback" {
		t.Fatal("base change should rollback when nested sync fails")
	}
}

func TestCompletedAction_DomainErrorMessage(t *testing.T) {
	if helpers.ErrCompletedActionFinancialsImmutable.Error() != "Finansijski podaci završene akcije ne mogu se mijenjati." {
		t.Fatalf("unexpected message: %q", helpers.ErrCompletedActionFinancialsImmutable.Error())
	}
}

func TestCompletedAction_ParallelUpdatesSerialized(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			a := akcija
			a.CenaClan = 50 + float64(idx)
			errs[idx] = runExecuteUpdateAkcijaTx(t, db, a, ActionNestedSyncInput{})
		}(i)
	}
	wg.Wait()
	failures := 0
	for _, err := range errs {
		if errors.Is(err, helpers.ErrCompletedActionFinancialsImmutable) {
			failures++
		}
	}
	if failures != 2 {
		t.Fatalf("expected both financial updates rejected, failures=%d", failures)
	}
	if reloadAkcijaCenaClan(t, db, akcija.ID) != 30 {
		t.Fatal("price must remain original")
	}
}

func TestExecuteUpdateAkcijaTx_LoadsAuthoritativeRow(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, true)
	// Mutate in-memory copy to completed=false; DB row stays completed=true.
	akcija.IsCompleted = false
	akcija.CenaClan = 99
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{})
	assertCompletedFinancialError(t, err)
}
