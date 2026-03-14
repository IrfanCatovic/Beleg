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
	if count > 0 {
		return
	}

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
}
