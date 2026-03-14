package seed

import (
	"beleg-app/backend/internal/models"
	"log"

	"gorm.io/gorm"
)

const DefaultKlubNaziv = "Demo klub"

func RunIfEmpty(db *gorm.DB) {
	var count int64
	if err := db.Model(&models.Klubovi{}).Count(&count).Error; err != nil {
		log.Printf("[seed] Greška pri proveri broja klubova: %v", err)
		return
	}
	if count == 0 {
		runInitialSeed(db)
		return
	}
	// Klubovi već postoje – eventualno dodeli akcije koje još imaju klub_id = 0 (npr. posle dodavanja kolone)
	backfillAkcijeKlubID(db)
}

// runInitialSeed kreira default klub i dodeljuje mu korisnike i akcije (samo kad nema nijednog kluba).
func runInitialSeed(db *gorm.DB) {
	klub := models.Klubovi{
		Naziv:             DefaultKlubNaziv,
		KorisnikAdminLimit: 3,
		KorisnikLimit:      100,
		MaxStorageGB:       5.0,
	}
	if err := db.Create(&klub).Error; err != nil {
		log.Printf("[seed] Greška pri kreiranju default kluba: %v", err)
		return
	}
	log.Printf("[seed] Kreiran default klub: %s (id=%d)", klub.Naziv, klub.ID)

	clubID := klub.ID
	result := db.Model(&models.Korisnik{}).
		Where("role != ?", "superadmin").
		Where("klub_id IS NULL").
		Update("klub_id", clubID)
	if result.Error != nil {
		log.Printf("[seed] Greška pri dodeli korisnika klubu: %v", result.Error)
		return
	}
	if result.RowsAffected > 0 {
		log.Printf("[seed] Dodeljeno %d korisnika default klubu", result.RowsAffected)
	}

	assignAkcijeToClub(db, clubID)
}

func assignAkcijeToClub(db *gorm.DB, clubID uint) {
	res := db.Model(&models.Akcija{}).Where("klub_id = 0 OR klub_id IS NULL").Update("klub_id", clubID)
	if res.Error != nil {
		log.Printf("[seed] Greška pri dodeli akcija klubu: %v", res.Error)
		return
	}
	if res.RowsAffected > 0 {
		log.Printf("[seed] Dodeljeno %d akcija default klubu", res.RowsAffected)
	}
}

// backfillAkcijeKlubID dodeljuje akcije sa klub_id = 0 prvom klubu (npr. posle dodavanja kolone).
func backfillAkcijeKlubID(db *gorm.DB) {
	var firstKlub models.Klubovi
	if err := db.First(&firstKlub).Error; err != nil {
		return
	}
	res := db.Model(&models.Akcija{}).Where("klub_id = 0 OR klub_id IS NULL").Update("klub_id", firstKlub.ID)
	if res.Error != nil || res.RowsAffected == 0 {
		return
	}
	log.Printf("[seed] Backfill: dodeljeno %d akcija klubu %s", res.RowsAffected, firstKlub.Naziv)
}
