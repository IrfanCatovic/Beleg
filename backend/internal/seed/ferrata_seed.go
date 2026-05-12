package seed

import (
	"encoding/json"
	"log"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// EnsureDemoFerrata upsertuje demo feratu (Đurđevica) i opcioni kontakt.
func EnsureDemoFerrata(db *gorm.DB) {
	const slug = "via-ferrata-djurdjevica"
	var existing models.Ferrata
	err := db.Where("slug = ?", slug).First(&existing).Error
	if err == nil {
		return
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		log.Printf("[seed] ferrata check: %v", err)
		return
	}

	highlights, _ := json.Marshal([]string{
		"Pogled na Ibar i Gazivode",
		"Duga vertikala i odličan adrenalin",
		"Standardna C/D ruta",
		"D/E varijanta za iskusnije",
	})
	oprema, _ := json.Marshal([]string{"Kaciga", "Pojas", "Ferrata set", "Rukavice"})

	f := models.Ferrata{
		Naziv:              "Via Ferrata Đurđevica",
		Slug:               slug,
		Drzava:             "Srbija",
		GradOpstina:        "Tutin",
		Lokacija:           "Ribariće, Tutin · Kanjon Ibra",
		KratakOpis:         "Adrenalinska ferata iznad kanjona Ibra, sa pogledom na Gazivode.",
		Opis:               "Via Ferrata Đurđevica je atraktivna ferrata za rekreativce i iskusnije penjače, sa standardnom C/D rutom i težom D/E opcijom.",
		Tezina:             "C/D",
		TezinaOpcija:       "D/E",
		DuzinaM:            700,
		VisinskaRazlikaM:   200,
		PrilazMin:          20,
		TrajanjeMin:        90,
		TrajanjeMax:        150,
		PogodnoZaPocetnike: "uz_vodica",
		ObaveznaOpremaJSON: oprema,
		HighlightsJSON:     highlights,
		CoverImage:         "/ferrate/djurdjevica-hero.png",
		Status:             "active",
	}
	if err := db.Create(&f).Error; err != nil {
		log.Printf("[seed] ferrata create: %v", err)
		return
	}
	log.Printf("[seed] Kreirana demo ferata: %s (id=%d)", f.Naziv, f.ID)

	contact := models.FerrataContact{
		FerrataID: f.ID,
		Ime:       "Lokalni vodič (demo)",
		Telefon:   "+381601234567",
		Napomena:  "Zameni u superadmin panelu pravim kontaktom.",
		Aktivan:   true,
	}
	if err := db.Create(&contact).Error; err != nil {
		log.Printf("[seed] ferrata contact: %v", err)
	}
}
