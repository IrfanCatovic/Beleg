package models

import (
	"testing"
	"time"

	"beleg-app/backend/internal/testdb"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testAkcijaCancellationDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(testdb.MemoryDSN(t, "models")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	return db
}

func TestAkcijaCancellation_AutoMigrateCreatesColumns(t *testing.T) {
	db := testAkcijaCancellationDB(t)
	if err := db.AutoMigrate(&Akcija{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	migrator := db.Migrator()
	for _, col := range []string{"is_cancelled", "cancelled_at", "cancellation_reason"} {
		if !migrator.HasColumn(&Akcija{}, col) {
			t.Fatalf("expected column %q after AutoMigrate", col)
		}
	}
	if !migrator.HasIndex(&Akcija{}, "idx_akcije_is_cancelled") {
		// GORM may name the index from the field; accept either convention.
		if !migrator.HasIndex(&Akcija{}, "IsCancelled") {
			t.Fatal("expected index on is_cancelled")
		}
	}
}

func TestAkcijaCancellation_CreateDefaults(t *testing.T) {
	db := testAkcijaCancellationDB(t)
	if err := db.AutoMigrate(&Akcija{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	a := Akcija{Naziv: "Defaults", Datum: time.Now().Add(48 * time.Hour)}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}

	var loaded Akcija
	if err := db.First(&loaded, a.ID).Error; err != nil {
		t.Fatal(err)
	}
	if loaded.IsCancelled {
		t.Fatal("IsCancelled must default to false")
	}
	if loaded.CancelledAt != nil {
		t.Fatal("CancelledAt must default to nil")
	}
	if loaded.CancellationReason != "" {
		t.Fatalf("CancellationReason must default to empty, got %q", loaded.CancellationReason)
	}
}

func TestAkcijaCancellation_ExistingTableAutoMigratePreservesRows(t *testing.T) {
	db := testAkcijaCancellationDB(t)

	// Legacy-shaped akcije table without cancellation columns (additive migrate target).
	if err := db.Exec(`
CREATE TABLE akcije (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  naziv TEXT,
  planina TEXT,
  vrh TEXT,
  datum DATETIME,
  opis TEXT,
  tezina TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  slika_url TEXT,
  is_completed INTEGER DEFAULT 0,
  ukupno_metara_uspona_akcija INTEGER DEFAULT 0,
  ukupno_km_akcija REAL DEFAULT 0,
  visina_vrh_m INTEGER DEFAULT 0,
  zimski_uspon INTEGER DEFAULT 0,
  vodic_id INTEGER DEFAULT 0,
  drugi_vodic_ime TEXT,
  added_by_id INTEGER DEFAULT 0,
  u_istoriji_kluba INTEGER DEFAULT 1,
  javna INTEGER DEFAULT 0,
  klub_id INTEGER,
  organizator_tip TEXT DEFAULT 'klub',
  tip_akcije TEXT DEFAULT 'planina',
  ferrata_id INTEGER,
  ferrata_snapshot_json TEXT,
  start_at DATETIME,
  end_at DATETIME,
  trajanje_sati REAL DEFAULT 0,
  rok_prijava DATETIME,
  max_ljudi INTEGER DEFAULT 0,
  mesto_polaska TEXT,
  kontakt_telefon TEXT,
  broj_dana INTEGER DEFAULT 1,
  cena_clan REAL DEFAULT 0,
  cena_ostali REAL DEFAULT 0,
  prikazi_listu_prijavljenih INTEGER DEFAULT 1,
  omoguci_grupni_chat INTEGER DEFAULT 0,
  planina_lat REAL,
  planina_lng REAL
)`).Error; err != nil {
		t.Fatalf("create legacy table: %v", err)
	}

	legacyNaziv := "Legacy row"
	legacyDatum := time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)
	if err := db.Exec(
		`INSERT INTO akcije (naziv, planina, vrh, datum, is_completed, organizator_tip, tip_akcije)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		legacyNaziv, "Durmitor", "Bobotov", legacyDatum, 0, "klub", "planina",
	).Error; err != nil {
		t.Fatalf("insert legacy row: %v", err)
	}

	var legacyID int64
	if err := db.Raw(`SELECT id FROM akcije WHERE naziv = ?`, legacyNaziv).Scan(&legacyID).Error; err != nil {
		t.Fatal(err)
	}
	if legacyID == 0 {
		t.Fatal("legacy row missing")
	}

	if err := db.AutoMigrate(&Akcija{}); err != nil {
		t.Fatalf("AutoMigrate on existing table: %v", err)
	}

	var loaded Akcija
	if err := db.First(&loaded, legacyID).Error; err != nil {
		t.Fatalf("legacy row must survive migrate: %v", err)
	}
	if loaded.Naziv != legacyNaziv {
		t.Fatalf("naziv=%q want %q", loaded.Naziv, legacyNaziv)
	}
	if loaded.Planina != "Durmitor" || loaded.Vrh != "Bobotov" {
		t.Fatalf("legacy fields changed: planina=%q vrh=%q", loaded.Planina, loaded.Vrh)
	}
	if loaded.IsCompleted {
		t.Fatal("IsCompleted must stay false")
	}
	if loaded.IsCancelled {
		t.Fatal("IsCancelled must default false after migrate")
	}
	if loaded.CancelledAt != nil {
		t.Fatal("CancelledAt must be nil after migrate")
	}
	if loaded.CancellationReason != "" {
		t.Fatalf("CancellationReason must be empty after migrate, got %q", loaded.CancellationReason)
	}

	var count int64
	if err := db.Model(&Akcija{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("row count=%d want 1 (no delete/recreate data loss)", count)
	}
}

func TestAkcijaCancellation_CancelledAtNullable(t *testing.T) {
	db := testAkcijaCancellationDB(t)
	if err := db.AutoMigrate(&Akcija{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	at := time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)
	a := Akcija{
		Naziv:              "Cancelled fixture",
		Datum:              time.Now().Add(24 * time.Hour),
		IsCancelled:        true,
		CancelledAt:        &at,
		CancellationReason: "Loši uslovi",
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}

	var loaded Akcija
	if err := db.First(&loaded, a.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !loaded.IsCancelled || loaded.CancelledAt == nil || loaded.CancellationReason != "Loši uslovi" {
		t.Fatalf("unexpected cancelled fields: %+v", loaded)
	}

	if err := db.Model(&loaded).Updates(map[string]any{
		"is_cancelled":        false,
		"cancelled_at":        nil,
		"cancellation_reason": "",
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&loaded, a.ID).Error; err != nil {
		t.Fatal(err)
	}
	if loaded.IsCancelled || loaded.CancelledAt != nil || loaded.CancellationReason != "" {
		t.Fatalf("nullable reset failed: %+v", loaded)
	}
}
