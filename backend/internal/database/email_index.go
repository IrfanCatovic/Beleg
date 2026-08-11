package database

import (
	"errors"
	"fmt"
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

const emailNormalizedUniqueIndexName = "idx_korisnici_email_normalized"

// DuplicateEmailError vraća se kada postoje duplikati non-empty normalizovanih emailova.
// Index se tada NE kreira; redovi se ne brišu i ne spajaju.
type DuplicateEmailError struct {
	Groups int
	Emails []string
}

func (e *DuplicateEmailError) Error() string {
	shown := e.Emails
	if len(shown) > 20 {
		shown = shown[:20]
	}
	return fmt.Sprintf(
		"duplicate normalized emails detected: %d groups (%s); unique index %s was not created; no rows were deleted or merged",
		e.Groups,
		strings.Join(shown, ", "),
		emailNormalizedUniqueIndexName,
	)
}

func IsDuplicateEmailError(err error) bool {
	var target *DuplicateEmailError
	return errors.As(err, &target)
}

// PostAutoMigrateCreateEmailIndexes kreira partial unique index na LOWER(TRIM(email))
// samo ako nema duplikata. Prazan email ostaje dozvoljen.
func PostAutoMigrateCreateEmailIndexes(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	if !db.Migrator().HasTable(&models.Korisnik{}) {
		return nil
	}
	if err := checkDuplicateNormalizedEmailsReadOnly(db); err != nil {
		return err
	}
	return ensureEmailNormalizedUniqueIndex(db)
}

func checkDuplicateNormalizedEmailsReadOnly(db *gorm.DB) error {
	type row struct {
		Email string
		N     int64
	}
	var rows []row
	if err := db.Raw(`
		SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS n
		FROM korisnici
		WHERE TRIM(COALESCE(email, '')) <> ''
		GROUP BY LOWER(TRIM(email))
		HAVING COUNT(*) > 1
	`).Scan(&rows).Error; err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}
	emails := make([]string, 0, len(rows))
	for _, r := range rows {
		emails = append(emails, r.Email)
	}
	return &DuplicateEmailError{Groups: len(rows), Emails: emails}
}

func ensureEmailNormalizedUniqueIndex(db *gorm.DB) error {
	dialect := strings.ToLower(db.Dialector.Name())
	switch dialect {
	case "postgres", "sqlite":
		sql := `
			CREATE UNIQUE INDEX IF NOT EXISTS idx_korisnici_email_normalized
			ON korisnici (LOWER(TRIM(email)))
			WHERE TRIM(COALESCE(email, '')) <> ''
		`
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("database: create %s failed: %w", emailNormalizedUniqueIndexName, err)
		}
		return nil
	default:
		return nil
	}
}
