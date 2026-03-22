package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/email"

	"github.com/gin-gonic/gin"
)

// CenaZahtevRequest sadrži podatke iz forme za zahtev ponude.
type CenaZahtevRequest struct {
	Paket              string `json:"paket" binding:"required"`
	ExtraUsers         int    `json:"extraUsers"`
	ExtraAdmins        int    `json:"extraAdmins"`
	Note               string `json:"note"`
	ImeKluba           string `json:"imeKluba"`
	ContactEmail       string `json:"contactEmail"`
	ContactPhone       string `json:"contactPhone"`
	BasePriceRsd       int    `json:"basePriceRsd"`
	ExtraUsersCostRsd  int    `json:"extraUsersCostRsd"`
	ExtraAdminsCostRsd int    `json:"extraAdminsCostRsd"`
	TotalMonthlyRsd    int    `json:"totalMonthlyRsd"`
}

// CenaZahtev prima zahtev za ponudu sa stranice Cena i šalje email na konfigurisani EMAIL_TO.
// Obavezno: imeKluba, contactPhone, contactEmail.
func CenaZahtev(c *gin.Context) {
	var req CenaZahtevRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}

	imeKluba := strings.TrimSpace(req.ImeKluba)
	emailStr := strings.TrimSpace(req.ContactEmail)
	phoneStr := strings.TrimSpace(req.ContactPhone)
	isKontaktForma := strings.EqualFold(strings.TrimSpace(req.Paket), "Kontakt forma")

	if imeKluba == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno unesite ime kluba"})
		return
	}
	if !isKontaktForma {
		if phoneStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno unesite broj telefona"})
			return
		}
		if emailStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno unesite email"})
			return
		}
	} else {
		if emailStr == "" {
			emailStr = "(nije unet – stranica Kontakt)"
		}
		if phoneStr == "" {
			phoneStr = "(nije unet – stranica Kontakt)"
		}
	}

	subject := "NaVrhu – zahtev za ponudu (paket " + req.Paket + ")"
	body := buildCenaEmailBody(req, imeKluba, emailStr, phoneStr)

	if err := email.SendWithTimeout(subject, body, 25*time.Second); err != nil {
		log.Printf("[cena-zahtev] greška pri slanju emaila: %v", err)
		msg := "Greška pri slanju poruke. Pokušajte ponovo kasnije."
		if strings.Contains(err.Error(), "nije odgovorio u roku") {
			msg = "Slanje je predugo trajalo. Proverite SMTP na serveru ili pokušajte kasnije."
		}
		if strings.Contains(err.Error(), "email nije konfigurisan") {
			msg = "Forma trenutno nije dostupna (email nije podešen na serveru)."
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	log.Printf("[cena-zahtev] email uspešno prosleđen SMTP serveru (klub=%s, paket=%s)", imeKluba, req.Paket)
	c.JSON(http.StatusOK, gin.H{"message": "Poruka je uspešno poslata. Javit ćemo vam se uskoro."})
}

func buildCenaEmailBody(req CenaZahtevRequest, imeKluba, emailStr, phoneStr string) string {
	var b strings.Builder
	b.WriteString("Nov zahtev za ponudu sa stranice Cena.\n\n")
	b.WriteString("---\n")
	b.WriteString(fmt.Sprintf("Ime kluba: %s\n\n", imeKluba))
	b.WriteString(fmt.Sprintf("Paket: %s\n", req.Paket))
	b.WriteString(fmt.Sprintf("Dodatni korisnici: %d\n", req.ExtraUsers))
	b.WriteString(fmt.Sprintf("Dodatni admin nalozi: %d\n\n", req.ExtraAdmins))
	b.WriteString("Cene (u RSD):\n")
	b.WriteString(fmt.Sprintf("  Osnovna cena paketa: %d din / mesec\n", req.BasePriceRsd))
	b.WriteString(fmt.Sprintf("  Dodatni korisnici: %d din / mesec\n", req.ExtraUsersCostRsd))
	b.WriteString(fmt.Sprintf("  Dodatni admini: %d din / mesec\n", req.ExtraAdminsCostRsd))
	b.WriteString(fmt.Sprintf("  UKUPNO mesečno: %d din\n\n", req.TotalMonthlyRsd))
	if req.Note != "" {
		b.WriteString("Dodatne napomene:\n" + req.Note + "\n\n")
	}
	b.WriteString("---\nKONTAKT:\n")
	b.WriteString("Email: " + emailStr + "\n")
	b.WriteString("Telefon: " + phoneStr + "\n")
	return b.String()
}
