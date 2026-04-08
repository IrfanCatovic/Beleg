package config

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// // Konekcija na bazu
// db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
// if err != nil {
// 	log.Fatal("Ne mogu da se povežem sa bazom:", err)
// } else {
// 	log.Println("Uspješno povezan sa bazom!")
// 	log.Print(".env je ucitan")
// }


func BuildDatabaseDSN() string {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
			os.Getenv("DB_HOST"),
			os.Getenv("DB_USER"),
			os.Getenv("DB_PASSWORD"),
			os.Getenv("DB_NAME"),
			os.Getenv("DB_PORT"),
			os.Getenv("DB_SSLMODE"),
			os.Getenv("DB_TIMEZONE"),
		)
	}
	return dsn
}

// STEP 4: Open DB connection function
// Create function: OpenDatabase(dsn string) (*gorm.DB, error)
// Goal:
// - open postgres connection via gorm.Open(postgres.Open(dsn), &gorm.Config{})
// Output:
// - return db on success
// - return error on failure (do not crash inside helper unless you intentionally choose Must-style)

// STEP 5: (Optional) Make a Must variant for startup style
// If project prefers fail-fast startup, add:
// - MustOpenDatabase(dsn string) *gorm.DB
// Behavior:
// - internally calls OpenDatabase
// - log.Fatal on error
// Use only if this matches your current main.go pattern.

// STEP 6: Connect helper from main.go
// In main.go:
// - import internal/config
// - replace inline DSN block with: dsn := config.BuildDatabaseDSN()
// - replace inline gorm.Open block with: db, err := config.OpenDatabase(dsn)
// Keep behavior same as before (no logic changes yet).

// STEP 7: Verify after each mini-step
// - run go build / go run after DSN extraction
// - run again after DB open extraction
// - fix only last step if broken (small rollback mindset).

// STEP 8: Migrations/seed are separate step (not in first pass)
// After DSN + connection are stable, then decide where to place:
// - AutoMigrate(...)
// - seed.RunIfEmpty(db)
// Keep refactor incremental.