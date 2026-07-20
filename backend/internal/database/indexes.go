package database

import (
	"errors"
	"fmt"
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

const prijavaUniqueIndexName = "idx_prijave_akcija_korisnik"
const signupPendingUniqueIndexName = "idx_signup_pending_unique"

// DuplicatePrijaveError vraća se kada postoje duplikati prije kreiranja unique indeksa.
// Ne sadrži korisničke podatke — samo broj duplicate grupa.
type DuplicatePrijaveError struct {
	Groups int
}

func (e *DuplicatePrijaveError) Error() string {
	return fmt.Sprintf(
		"duplicate prijave detected: %d (akcija_id, korisnik_id) groups require manual review and database backup before any cleanup; unique index %s was not created",
		e.Groups,
		prijavaUniqueIndexName,
	)
}

// DuplicatePendingSignupError vraća se kada postoje duplikati pending signup zahteva.
type DuplicatePendingSignupError struct {
	Groups int
}

func (e *DuplicatePendingSignupError) Error() string {
	return fmt.Sprintf(
		"duplicate pending signup requests detected: %d (akcija_id, requester_id) groups require manual review and database backup before any cleanup; unique index %s was not created",
		e.Groups,
		signupPendingUniqueIndexName,
	)
}

// PostAutoMigrateCreatePrijavaIndexes provjerava duplikate (read-only) i kreira unique indekse.
// Unique na prijave(akcija_id, korisnik_id) se NE stavlja u GORM tag da AutoMigrate
// ne padne na produkciji sa postojećim duplikatima prije ove provjere.
func PostAutoMigrateCreatePrijavaIndexes(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	migrator := db.Migrator()
	if !migrator.HasTable(&models.Prijava{}) {
		return nil
	}
	if err := checkDuplicatePrijaveReadOnly(db); err != nil {
		return err
	}
	if err := ensurePrijavaUniqueIndex(db); err != nil {
		return err
	}
	if !migrator.HasTable(&models.ActionSignupRequest{}) {
		return nil
	}
	if err := checkDuplicatePendingSignupReadOnly(db); err != nil {
		return err
	}
	return ensurePendingSignupPartialUniqueIndex(db)
}

func checkDuplicatePrijaveReadOnly(db *gorm.DB) error {
	groups, err := countDuplicatePrijavaGroups(db)
	if err != nil {
		return err
	}
	if groups > 0 {
		return &DuplicatePrijaveError{Groups: groups}
	}
	return nil
}

func checkDuplicatePendingSignupReadOnly(db *gorm.DB) error {
	groups, err := countDuplicatePendingSignupGroups(db)
	if err != nil {
		return err
	}
	if groups > 0 {
		return &DuplicatePendingSignupError{Groups: groups}
	}
	return nil
}

func countDuplicatePrijavaGroups(db *gorm.DB) (int, error) {
	var count int64
	err := db.Raw(`
		SELECT COUNT(*) FROM (
			SELECT akcija_id, korisnik_id
			FROM prijave
			GROUP BY akcija_id, korisnik_id
			HAVING COUNT(*) > 1
		) AS duplicate_groups
	`).Scan(&count).Error
	return int(count), err
}

func countDuplicatePendingSignupGroups(db *gorm.DB) (int, error) {
	var count int64
	err := db.Raw(`
		SELECT COUNT(*) FROM (
			SELECT akcija_id, requester_id
			FROM action_signup_requests
			WHERE status = ?
			GROUP BY akcija_id, requester_id
			HAVING COUNT(*) > 1
		) AS duplicate_groups
	`, models.ActionSignupRequestPending).Scan(&count).Error
	return int(count), err
}

func ensurePrijavaUniqueIndex(db *gorm.DB) error {
	sql := `
		CREATE UNIQUE INDEX IF NOT EXISTS idx_prijave_akcija_korisnik
		ON prijave (akcija_id, korisnik_id)
	`
	if err := db.Exec(sql).Error; err != nil {
		return fmt.Errorf("database: create %s failed: %w", prijavaUniqueIndexName, err)
	}
	return nil
}

func ensurePendingSignupPartialUniqueIndex(db *gorm.DB) error {
	dialect := strings.ToLower(db.Dialector.Name())
	switch dialect {
	case "postgres", "sqlite":
		sql := `
			CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_pending_unique
			ON action_signup_requests (akcija_id, requester_id)
			WHERE status = 'pending'
		`
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("database: create %s failed: %w", signupPendingUniqueIndexName, err)
		}
		return nil
	default:
		// Na ostalim dialektima ostaje app-level guard u handlerima.
		return nil
	}
}

// MaintenanceCleanupDuplicatePrijave uklanja duplikate u prijave nakon ručnog pregleda i backup-a.
// NIKADA se ne poziva tokom normalnog startup-a.
func MaintenanceCleanupDuplicatePrijave(db *gorm.DB) (removed int64, err error) {
	if db == nil {
		return 0, nil
	}
	if !db.Migrator().HasTable(&models.Prijava{}) {
		return 0, nil
	}
	return maintenanceDedupeDuplicatePrijave(db)
}

func maintenanceDedupeDuplicatePrijave(db *gorm.DB) (int64, error) {
	dialect := strings.ToLower(db.Dialector.Name())
	var totalRemoved int64

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
			return 0, fmt.Errorf("maintenance dedupe prijava_izbori: %w", err)
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
			return 0, fmt.Errorf("maintenance dedupe prijave: %w", res.Error)
		}
		totalRemoved = res.RowsAffected
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
			return 0, fmt.Errorf("maintenance dedupe prijave scan: %w", err)
		}
		for _, d := range dups {
			var removeIDs []uint
			if err := db.Raw(`
				SELECT id FROM prijave
				WHERE akcija_id = ? AND korisnik_id = ? AND id <> ?
			`, d.AkcijaID, d.KorisnikID, d.KeepID).Scan(&removeIDs).Error; err != nil {
				return totalRemoved, fmt.Errorf("maintenance dedupe prijave ids: %w", err)
			}
			if len(removeIDs) == 0 {
				continue
			}
			if err := db.Exec("DELETE FROM prijava_izbori WHERE prijava_id IN ?", removeIDs).Error; err != nil {
				return totalRemoved, err
			}
			res := db.Exec("DELETE FROM prijave WHERE id IN ?", removeIDs)
			if res.Error != nil {
				return totalRemoved, res.Error
			}
			totalRemoved += res.RowsAffected
		}
	}
	return totalRemoved, nil
}

// IsDuplicatePrijaveError reports whether err is a read-only duplicate detection failure.
func IsDuplicatePrijaveError(err error) bool {
	var target *DuplicatePrijaveError
	return errors.As(err, &target)
}

// IsDuplicatePendingSignupError reports whether err is a pending signup duplicate detection failure.
func IsDuplicatePendingSignupError(err error) bool {
	var target *DuplicatePendingSignupError
	return errors.As(err, &target)
}
