package handlers

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testNestedSyncDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Akcija{},
		&models.AkcijaSmestaj{},
		&models.AkcijaPrevoz{},
		&models.AkcijaOprema{},
		&models.AkcijaOpremaRent{},
		&models.Korisnik{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedAkcijaWithNested(t *testing.T, db *gorm.DB) (models.Akcija, models.AkcijaSmestaj, models.AkcijaPrevoz, models.AkcijaOpremaRent) {
	t.Helper()
	future := time.Now().Add(72 * time.Hour)
	akcija := models.Akcija{Naziv: "Test", Datum: future}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	smestaj := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "Hotel A", CenaPoOsobiUkupno: 50}
	if err := db.Create(&smestaj).Error; err != nil {
		t.Fatal(err)
	}
	prevoz := models.AkcijaPrevoz{AkcijaID: akcija.ID, TipPrevoza: "autobus", NazivGrupe: "Grupa 1", Kapacitet: 10}
	if err := db.Create(&prevoz).Error; err != nil {
		t.Fatal(err)
	}
	oprema := models.AkcijaOprema{AkcijaID: akcija.ID, Naziv: "Štap", Obavezna: true}
	if err := db.Create(&oprema).Error; err != nil {
		t.Fatal(err)
	}
	rent := models.AkcijaOpremaRent{
		AkcijaID:         akcija.ID,
		AkcijaOpremaID:   &oprema.ID,
		NazivOpreme:      "Štap",
		DostupnaKolicina: 5,
		CenaPoSetu:       10,
	}
	if err := db.Create(&rent).Error; err != nil {
		t.Fatal(err)
	}
	return akcija, smestaj, prevoz, rent
}

func countNestedRows(t *testing.T, db *gorm.DB, akcijaID uint) (smestaj, prevoz, rent int64) {
	t.Helper()
	_ = db.Model(&models.AkcijaSmestaj{}).Where("akcija_id = ?", akcijaID).Count(&smestaj).Error
	_ = db.Model(&models.AkcijaPrevoz{}).Where("akcija_id = ?", akcijaID).Count(&prevoz).Error
	_ = db.Model(&models.AkcijaOpremaRent{}).Where("akcija_id = ?", akcijaID).Count(&rent).Error
	return smestaj, prevoz, rent
}

func seedPrijavaWithSmestajChoice(t *testing.T, db *gorm.DB, akcijaID, korisnikID, smestajID uint) {
	t.Helper()
	prijava := models.Prijava{AkcijaID: akcijaID, KorisnikID: korisnikID, Status: "prijavljen"}
	if err := db.Create(&prijava).Error; err != nil {
		t.Fatal(err)
	}
	smestajJSON, _ := json.Marshal([]uint{smestajID})
	izbor := models.PrijavaIzbori{
		PrijavaID:            prijava.ID,
		SelectedSmestajIDs:   string(smestajJSON),
		SelectedPrevozIDs:    "[]",
		SelectedRentItemsRaw: "[]",
	}
	if err := db.Create(&izbor).Error; err != nil {
		t.Fatal(err)
	}
}

func TestSyncActionNestedDataOnUpdate_OmittedFieldsPreserveExisting(t *testing.T) {
	db := testNestedSyncDB(t)
	akcija, _, _, _ := seedAkcijaWithNested(t, db)

	err := syncActionNestedDataOnUpdate(db, akcija.ID, ActionNestedSyncInput{})
	if err != nil {
		t.Fatalf("sync: %v", err)
	}

	s, p, r := countNestedRows(t, db, akcija.ID)
	if s != 1 || p != 1 || r != 1 {
		t.Fatalf("expected 1/1/1 nested rows, got %d/%d/%d", s, p, r)
	}
}

func TestSyncActionNestedDataOnUpdate_EmptyListRemovesWhenNoPrijave(t *testing.T) {
	db := testNestedSyncDB(t)
	akcija, _, _, _ := seedAkcijaWithNested(t, db)
	empty := "[]"

	err := syncActionNestedDataOnUpdate(db, akcija.ID, ActionNestedSyncInput{
		Smestaj: &empty,
		Oprema:  &empty,
		Prevoz:  &empty,
	})
	if err != nil {
		t.Fatalf("sync: %v", err)
	}

	s, p, r := countNestedRows(t, db, akcija.ID)
	if s != 0 || p != 0 || r != 0 {
		t.Fatalf("expected 0/0/0 nested rows, got %d/%d/%d", s, p, r)
	}
}

func TestSyncActionNestedDataOnUpdate_EmptyListRejectedWhenPrijaveUseOptions(t *testing.T) {
	db := testNestedSyncDB(t)
	akcija, smestaj, _, _ := seedAkcijaWithNested(t, db)
	user := models.Korisnik{Username: "member", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	seedPrijavaWithSmestajChoice(t, db, akcija.ID, user.ID, smestaj.ID)
	empty := "[]"

	err := syncActionNestedDataOnUpdate(db, akcija.ID, ActionNestedSyncInput{Smestaj: &empty})
	if !errors.Is(err, ErrNestedOptionInUse) {
		t.Fatalf("expected ErrNestedOptionInUse, got %v", err)
	}

	var remaining int64
	if err := db.Model(&models.AkcijaSmestaj{}).Where("akcija_id = ?", akcija.ID).Count(&remaining).Error; err != nil {
		t.Fatal(err)
	}
	if remaining != 1 {
		t.Fatalf("smestaj should remain, count=%d", remaining)
	}
}

func TestSyncActionNestedDataOnUpdate_ModifiedListPreservesReferencedIDs(t *testing.T) {
	db := testNestedSyncDB(t)
	akcija, smestaj, _, _ := seedAkcijaWithNested(t, db)
	user := models.Korisnik{Username: "member", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	seedPrijavaWithSmestajChoice(t, db, akcija.ID, user.ID, smestaj.ID)

	updated := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":75,"opis":"Nova cena"}]`
	err := syncActionNestedDataOnUpdate(db, akcija.ID, ActionNestedSyncInput{Smestaj: &updated})
	if err != nil {
		t.Fatalf("sync: %v", err)
	}

	var row models.AkcijaSmestaj
	if err := db.Where("akcija_id = ?", akcija.ID).First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.ID != smestaj.ID {
		t.Fatalf("expected smestaj ID %d preserved, got %d", smestaj.ID, row.ID)
	}
	if row.CenaPoOsobiUkupno != 75 {
		t.Fatalf("expected updated price 75, got %v", row.CenaPoOsobiUkupno)
	}
}

func TestSyncActionNestedDataOnUpdate_PartialFailureDoesNotChangeOtherCategories(t *testing.T) {
	db := testNestedSyncDB(t)
	akcija, smestaj, prevoz, _ := seedAkcijaWithNested(t, db)
	user := models.Korisnik{Username: "member", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	seedPrijavaWithSmestajChoice(t, db, akcija.ID, user.ID, smestaj.ID)
	empty := "[]"

	err := syncActionNestedDataOnUpdate(db, akcija.ID, ActionNestedSyncInput{Smestaj: &empty})
	if !errors.Is(err, ErrNestedOptionInUse) {
		t.Fatalf("expected ErrNestedOptionInUse, got %v", err)
	}

	var smestajCount int64
	if err := db.Model(&models.AkcijaSmestaj{}).Where("id = ?", smestaj.ID).Count(&smestajCount).Error; err != nil {
		t.Fatal(err)
	}
	var prevozRow models.AkcijaPrevoz
	if err := db.First(&prevozRow, prevoz.ID).Error; err != nil {
		t.Fatalf("prevoz should remain unchanged: %v", err)
	}
	if smestajCount != 1 || prevozRow.ID != prevoz.ID {
		t.Fatal("nested data should be unchanged after failed sync")
	}
}

func TestSyncActionNestedDataOnUpdate_RenameBlockedWhenReferenced(t *testing.T) {
	db := testNestedSyncDB(t)
	akcija, smestaj, _, _ := seedAkcijaWithNested(t, db)
	user := models.Korisnik{Username: "member", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	seedPrijavaWithSmestajChoice(t, db, akcija.ID, user.ID, smestaj.ID)

	renamed := `[{"naziv":"Hotel B","cenaPoOsobiUkupno":50,"opis":""}]`
	err := syncActionNestedDataOnUpdate(db, akcija.ID, ActionNestedSyncInput{Smestaj: &renamed})
	if !errors.Is(err, ErrNestedOptionInUse) {
		t.Fatalf("expected ErrNestedOptionInUse when removing referenced option, got %v", err)
	}
}
