package database

import (
	"log"
	"strings"

	"gorm.io/gorm"
)

// EnsurePrijavaIntegrity uklanja duplikate prijava (zadržava najstariji red po id)
// i kreira partial unique index za pending signup zahteve.
// Poziva se posle GORM AutoMigrate.
func EnsurePrijavaIntegrity(db *gorm.DB) {
	dedupeDuplicatePrijave(db)
	ensurePendingSignupPartialUniqueIndex(db)
}

func dedupeDuplicatePrijave(db *gorm.DB) {
	dialect := strings.ToLower(db.Dialector.Name())

	// Obriši duplikate: zadrži MIN(id) po (akcija_id, korisnik_id).
	// Prvo prijava_izbori za duplirane prijave.
	switch dialect {
	case "postgres":
		if err := db.Exec(`
			DELETE FROM prijava_izbori
			WHERE prijava_id IN (
				SELECT p.id FROM prijave p
				INNER JOIN (
					SELECT akcija_id, korisnik_id, MIN(id) AS keep_id
					FROM prijave
					GROUP BY akcija_id, korisnik_id
					HAVING COUNT(*) > 1
				) d ON p.akcija_id = d.akcija_id AND p.korisnik_id = d.korisnik_id AND p.id <> d.keep_id
			)
		`).Error; err != nil {
			log.Printf("database: dedupe prijava_izbori skipped: %v", err)
		}
		if err := db.Exec(`
			DELETE FROM prijave p
			USING (
				SELECT akcija_id, korisnik_id, MIN(id) AS keep_id
				FROM prijave
				GROUP BY akcija_id, korisnik_id
				HAVING COUNT(*) > 1
			) d
			WHERE p.akcija_id = d.akcija_id AND p.korisnik_id = d.korisnik_id AND p.id <> d.keep_id
		`).Error; err != nil {
			log.Printf("database: dedupe prijave skipped: %v", err)
		}
	default:
		// SQLite i ostali: iterativno brisanje preko GORM.
		type dupKey struct {
			AkcijaID   uint
			KorisnikID uint
			KeepID     uint
		}
		var dups []dupKey
		_ = db.Raw(`
			SELECT akcija_id, korisnik_id, MIN(id) AS keep_id
			FROM prijave
			GROUP BY akcija_id, korisnik_id
			HAVING COUNT(*) > 1
		`).Scan(&dups).Error
		for _, d := range dups {
			var removeIDs []uint
			_ = db.Raw(`
				SELECT id FROM prijave
				WHERE akcija_id = ? AND korisnik_id = ? AND id <> ?
			`, d.AkcijaID, d.KorisnikID, d.KeepID).Scan(&removeIDs).Error
			if len(removeIDs) == 0 {
				continue
			}
			_ = db.Exec("DELETE FROM prijava_izbori WHERE prijava_id IN ?", removeIDs).Error
			_ = db.Exec("DELETE FROM prijave WHERE id IN ?", removeIDs).Error
		}
	}
}

func ensurePendingSignupPartialUniqueIndex(db *gorm.DB) {
	// Jedan pending zahtev po (akcija, korisnik). Odbijeni/otkazani ne blokiraju novi zahtev.
	const indexName = "idx_signup_pending_unique"
	switch strings.ToLower(db.Dialector.Name()) {
	case "postgres":
		if err := db.Exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_pending_unique
			ON action_signup_requests (akcija_id, requester_id)
			WHERE status = 'pending'
		`).Error; err != nil {
			log.Printf("database: create %s skipped: %v", indexName, err)
		}
	default:
		// SQLite podržava partial index od 3.8+
		if err := db.Exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_pending_unique
			ON action_signup_requests (akcija_id, requester_id)
			WHERE status = 'pending'
		`).Error; err != nil {
			log.Printf("database: create %s skipped (backend check ostaje): %v", indexName, err)
		}
	}
}
