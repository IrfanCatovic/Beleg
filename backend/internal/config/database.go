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

func OpenDatabase(dsn string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

// STEP 7: Verify after each mini-step
// - run go build / go run after DSN extraction
// - run again after DB open extraction
// - fix only last step if broken (small rollback mindset).

