package handlers

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"gorm.io/gorm"
)

func seedPrijavaWithStatusPlatio(t *testing.T, db *gorm.DB, akcijaID, userID uint, status string, platio bool) models.Prijava {
	t.Helper()
	u := models.Korisnik{Username: fmt.Sprintf("u_%d_%s", userID, status), Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcijaID, KorisnikID: u.ID, Status: status, Platio: platio}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func countPlatioTrue(t *testing.T, db *gorm.DB, akcijaID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Prijava{}).Where("akcija_id = ? AND platio = ?", akcijaID, true).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func runMarkPaidTx(t *testing.T, db *gorm.DB, prijavaID uint, platio bool) error {
	t.Helper()
	return db.Transaction(func(tx *gorm.DB) error {
		var probe models.Prijava
		if err := tx.First(&probe, prijavaID).Error; err != nil {
			return err
		}
		lockedAkcija, err := helpers.LockAkcijaForUpdate(tx, probe.AkcijaID)
		if err != nil {
			return err
		}
		lockedPrijava, err := helpers.LockPrijavaForUpdate(tx, prijavaID)
		if err != nil {
			return err
		}
		if lockedPrijava.AkcijaID != lockedAkcija.ID {
			return errors.New("prijava mismatch")
		}
		lockedPrijava.Platio = platio
		return tx.Save(lockedPrijava).Error
	})
}

func TestActiveAction_CenaClanChangeResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 1, "prijavljen", true)
	akcija.CenaClan = 50
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected Platio reset for prijavljen")
	}
}

func TestActiveAction_CenaOstaliChangeResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 2, "prijavljen", true)
	akcija.CenaOstali = 55
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset")
	}
}

func TestActiveAction_SmestajPriceChangeResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedNestedFinancialOptions(t, db, akcija.ID)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 3, "prijavljen", true)
	updated := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":50,"opis":""}]`
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &updated}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset")
	}
}

func TestActiveAction_PrevozPriceChangeResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedNestedFinancialOptions(t, db, akcija.ID)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 4, "prijavljen", true)
	updated := `[{"tipPrevoza":"autobus","nazivGrupe":"Grupa 1","kapacitet":10,"cenaPoOsobi":25}]`
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Prevoz: &updated}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset")
	}
}

func TestActiveAction_RentPriceChangeResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedNestedFinancialOptions(t, db, akcija.ID)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 5, "prijavljen", true)
	updated := `[{"naziv":"Štap","dostupnaKolicina":5,"cenaPoSetu":20}]`
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Oprema: &updated}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset")
	}
}

func TestActiveAction_JavnaChangeResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 6, "prijavljen", true)
	akcija.Javna = false
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset")
	}
}

func TestActiveAction_VodicIDChangeResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	g1 := seedUser(t, db, "g1_reset")
	g2 := seedUser(t, db, "g2_reset")
	akcija := seedAkcijaFinancialBase(t, db, false)
	akcija.VodicID = g1.ID
	if err := db.Save(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 7, "prijavljen", true)
	akcija.VodicID = g2.ID
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset")
	}
}

func TestActiveAction_AddFinancialOptionResetsPlatio(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedNestedFinancialOptions(t, db, akcija.ID)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 8, "prijavljen", true)
	added := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":30,"opis":""},{"naziv":"Hotel B","cenaPoOsobiUkupno":20,"opis":""}]`
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &added}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset")
	}
}

func TestActiveAction_StatusScopesForReset(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	pPrijavljen := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 10, "prijavljen", true)
	pPopeo := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 11, "popeo se", true)
	pNije := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 12, "nije uspeo", true)
	pOtkazano := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 13, "otkazano", true)
	pFalse := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 14, "prijavljen", false)

	akcija.CenaClan = 99
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	for _, id := range []uint{pPrijavljen.ID, pPopeo.ID, pNije.ID} {
		if getPrijavaPlatio(t, db, id) {
			t.Fatalf("expected Platio=false for prijava %d", id)
		}
	}
	if !getPrijavaPlatio(t, db, pOtkazano.ID) {
		t.Fatal("otkazano Platio=true must remain")
	}
	if getPrijavaPlatio(t, db, pFalse.ID) {
		t.Fatal("Platio=false must remain false")
	}
}

func TestActiveAction_NonFinancialChangeNoReset(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	p := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 20, "prijavljen", true)
	akcija.Opis = "Samo opis"
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("non-financial change must not reset Platio")
	}
}

func TestActiveAction_IdenticalFinancialPayloadNoReset(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedNestedFinancialOptions(t, db, akcija.ID)
	p := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 21, "prijavljen", true)
	smestaj := `[{"naziv":"Hotel A","cenaPoOsobiUkupno":30,"opis":""}]`
	prevoz := `[{"tipPrevoza":"autobus","nazivGrupe":"Grupa 1","kapacitet":10,"cenaPoOsobi":15}]`
	oprema := `[{"naziv":"Štap","dostupnaKolicina":5,"cenaPoSetu":10}]`
	akcija.Naziv = "Renamed only"
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{Smestaj: &smestaj, Prevoz: &prevoz, Oprema: &oprema}); err != nil {
		t.Fatal(err)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("identical financial payload must not reset Platio")
	}
}

func TestActiveAction_BulkResetUsesSingleUpdate(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	for i := 0; i < 500; i++ {
		seedPrijavaWithStatusPlatio(t, db, akcija.ID, uint(100+i), "prijavljen", true)
	}
	akcija.CenaClan = 99
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatalf("expected all 500 reset, got %d platio=true", countPlatioTrue(t, db, akcija.ID))
	}
}

func TestConcurrency_UpdateAkcijaThenMarkPaid(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	p := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 30, "prijavljen", true)
	akcija.CenaClan = 50
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected reset after price change")
	}
	if err := runMarkPaidTx(t, db, p.ID, true); err != nil {
		t.Fatal(err)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=true after mark-paid")
	}
}

func TestConcurrency_MarkPaidThenUpdateAkcija(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	p := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 31, "prijavljen", true)
	if err := runMarkPaidTx(t, db, p.ID, true); err != nil {
		t.Fatal(err)
	}
	akcija.CenaClan = 50
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false after price change")
	}
}

func TestConcurrency_UpdateAkcijaThenFinish(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	if err := db.AutoMigrate(&models.Transakcija{}); err != nil {
		t.Fatal(err)
	}
	actor := seedUser(t, db, "admin_finish")
	akcija := seedAkcijaFinancialBase(t, db, false)
	pReset := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 40, "prijavljen", true)
	akcija.CenaClan = 50
	if err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{}); err != nil {
		t.Fatal(err)
	}
	if countPlatioTrue(t, db, akcija.ID) != 0 {
		t.Fatal("expected reset before finish")
	}
	// Resolve result status before finish (new lifecycle guard).
	if err := db.Model(&pReset).Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}
	p := seedPrijavaWithStatusPlatio(t, db, akcija.ID, 41, "popeo se", true)
	if err := runMarkPaidTx(t, db, p.ID, true); err != nil {
		t.Fatal(err)
	}
	var fresh models.Akcija
	if err := db.First(&fresh, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	res, err := actions.FinishAction(db, &fresh, actor, actions.FinishActionInput{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
	if res.PrihodUkupan <= 0 {
		t.Fatal("finish should use new CenaClan-based saldo")
	}
}

func TestConcurrency_FinishThenFinancialUpdateRejected(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	if err := db.AutoMigrate(&models.Transakcija{}); err != nil {
		t.Fatal(err)
	}
	actor := seedUser(t, db, "admin_finish2")
	akcija := seedAkcijaFinancialBase(t, db, false)
	var fresh models.Akcija
	if err := db.First(&fresh, akcija.ID).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := actions.FinishAction(db, &fresh, actor, actions.FinishActionInput{}); err != nil {
		t.Fatal(err)
	}
	akcija.CenaClan = 99
	err := runExecuteUpdateAkcijaTx(t, db, akcija, ActionNestedSyncInput{})
	if !errors.Is(err, helpers.ErrCompletedActionFinancialsImmutable) {
		t.Fatalf("expected immutable error, got %v", err)
	}
}

func TestResetPaidPrijaveForFinancialChangeTx_Unit(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	akcija := seedAkcijaFinancialBase(t, db, false)
	seedPrijavaWithStatusPlatio(t, db, akcija.ID, 50, "prijavljen", true)
	var affected int64
	if err := db.Transaction(func(tx *gorm.DB) error {
		n, err := helpers.ResetPaidPrijaveForFinancialChangeTx(tx, akcija.ID)
		affected = n
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if affected != 1 {
		t.Fatalf("expected 1 row affected, got %d", affected)
	}
}

func TestUpdateMojaPrijavaIzbori_LocksAkcijaBeforePrijava(t *testing.T) {
	db := testPrijaviDB(t)
	user := seedUser(t, db, "lock_order")
	akcija := seedOpenAkcija(t, db, 10)
	seedPrijavaSPlatio(t, db, akcija.ID, user.ID, true, "[]")
	code, _ := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username, prijavaChoicesPayload{})
	if code != 200 {
		t.Fatalf("expected 200 with Akcija→Prijava lock order, got %d", code)
	}
}

func TestFinishAction_RejectsAlreadyCompleted(t *testing.T) {
	db := testUpdateAkcijaDB(t)
	if err := db.AutoMigrate(&models.Transakcija{}); err != nil {
		t.Fatal(err)
	}
	actor := seedUser(t, db, "finish_twice")
	akcija := models.Akcija{
		Naziv: "Done", Planina: "T", Vrh: "V", Datum: time.Now().Add(24 * time.Hour),
		Tezina: "srednje", IsCompleted: true,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	_, err := actions.FinishAction(db, &akcija, actor, actions.FinishActionInput{})
	if !errors.Is(err, helpers.ErrAkcijaAlreadyComplete) {
		t.Fatalf("expected ErrAkcijaAlreadyComplete, got %v", err)
	}
}
