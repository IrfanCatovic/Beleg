package database

import (
	"log"
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

const prijavaUniqueIndexName = "idx_prijave_akcija_korisnik"
const signupPendingUniqueIndexName = "idx_signup_pending_unique"

// PreAutoMigrateCleanupDuplicatePrijave uklanja duplikate u prijave PRE AutoMigrate-a.
// Bezbedno je na praznoj bazi i no-op ako tabela prijave još ne postoji.
// Zadržava red sa najmanjim id po (akcija_id, korisnik_id).
func PreAutoMigrateCleanupDuplicatePrijave(db *gorm.DB) {
	if db == nil {
		return
	}
	migrator := db.Migrator()
	if !migrator.HasTable(&models.Prijava{}) {
		return
	}
	dedupeDuplicatePrijave(db)
}

// PostAutoMigrateCreatePrijavaIndexes kreira unique indexe POSLE AutoMigrate-a.
// Unique na prijave(akcija_id, korisnik_id) se NE stavlja u GORM tag da AutoMigrate
// ne padne pre dedupe-a na produkciji sa postojećim duplikatima.
func PostAutoMigrateCreatePrijavaIndexes(db *gorm.DB) {
	if db == nil {
		return
	}
	migrator := db.Migrator()
	if !migrator.HasTable(&models.Prijava{}) {
		return
	}
	ensurePrijavaUniqueIndex(db)
	ensurePendingSignupPartialUniqueIndex(db)
}

func dedupeDuplicatePrijave(db *gorm.DB) {
	dialect := strings.ToLower(db.Dialector.Name())

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
			log.Printf("database: dedupe prijava_izbori: %v", err)
			return
		}
		res := db.Exec(`
			DELETE FROM prijave p
			USING (
				SELECT akcija_id, korisnik_id, MIN(id) AS keep_id
				FROM prijave
				GROUP BY akcija_id, korisnik_id
				HAVING COUNT(*) > 1
			) d
			WHERE p.akcija_id = d.akcija_id AND p.korisnik_id = d.korisnik_id AND p.id <> d.keep_id
		`)
		if res.Error != nil {
			log.Printf("database: dedupe prijave: %v", res.Error)
			return
		}
		if res.RowsAffected > 0 {
			log.Printf("database: uklonjeno %d duplikata u prijave (zadržan najmanji id)", res.RowsAffected)
		}
	default:
		type dupKey struct {
			AkcijaID   uint
			KorisnikID uint
			KeepID     uint
		}
		var dups []dupKey
		if err := db.Raw(`
			SELECT akcija_id, korisnik_id, MIN(id) AS keep_id
			FROM prijave
			GROUP BY akcija_id, korisnik_id
			HAVING COUNT(*) > 1
		`).Scan(&dups).Error; err != nil {
			log.Printf("database: dedupe prijave scan: %v", err)
			return
		}
		for _, d := range dups {
			var removeIDs []uint
			if err := db.Raw(`
				SELECT id FROM prijave
				WHERE akcija_id = ? AND korisnik_id = ? AND id <> ?
			`, d.AkcijaID, d.KorisnikID, d.KeepID).Scan(&removeIDs).Error; err != nil {
				log.Printf("database: dedupe prijave ids: %v", err)
				continue
			}
			if len(removeIDs) == 0 {
				continue
			}
			_ = db.Exec("DELETE FROM prijava_izbori WHERE prijava_id IN ?", removeIDs).Error
			_ = db.Exec("DELETE FROM prijave WHERE id IN ?", removeIDs).Error
		}
	}
}

func ensurePrijavaUniqueIndex(db *gorm.DB) {
	sql := `
		CREATE UNIQUE INDEX IF NOT EXISTS idx_prijave_akcija_korisnik
		ON prijave (akcija_id, korisnik_id)
	`
	if err := db.Exec(sql).Error; err != nil {
		log.Printf("database: create %s failed: %v", prijavaUniqueIndexName, err)
	}
}

func ensurePendingSignupPartialUniqueIndex(db *gorm.DB) {
	if !db.Migrator().HasTable(&models.ActionSignupRequest{}) {
		return
	}
	sql := `
		CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_pending_unique
		ON action_signup_requests (akcija_id, requester_id)
		WHERE status = 'pending'
	`
	if err := db.Exec(sql).Error; err != nil {
		log.Printf("database: create %s failed (backend check ostaje): %v", signupPendingUniqueIndexName, err)
	}
}
