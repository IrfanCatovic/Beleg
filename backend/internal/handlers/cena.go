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
	// Log za produkciju: ako ovoga nema u logovima, zahtev ne stiže do API-ja (CORS, pogrešan URL).
	log.Printf("[cena-zahtev] primljen zahtev od %s", c.ClientIP())

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
		msg := humanizeEmailSendError(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	log.Printf("[cena-zahtev] email uspešno poslat (klub=%s, paket=%s)", imeKluba, req.Paket)
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

// humanizeEmailSendError — korisniku bezbedne poruke; pun tekst greške ostaje u server logu.
func humanizeEmailSendError(err error) string {
	if err == nil {
		return "Greška pri slanju poruke."
	}
	e := strings.ToLower(err.Error())

	if strings.Contains(e, "email nije konfigurisan") {
		return "Forma trenutno nije dostupna (nema SMTP/Resend podešavanja na serveru)."
	}
	if strings.Contains(e, "nije odgovorio u roku") || strings.Contains(e, "i/o timeout") || strings.Contains(e, "connection timed out") {
		return "Server ne može da se poveže na SMTP u roku. Na Renderu je često blokiran port 587 — u env dodajte Resend (RESEND_API_KEY + RESEND_FROM) ili drugi HTTPS email servis."
	}
	if strings.Contains(e, "connection refused") || strings.Contains(e, "no route to host") {
		return "Konekcija ka SMTP serveru je odbijena (često na cloud hostingu). Koristite Resend: RESEND_API_KEY i RESEND_FROM na Renderu."
	}
	// Gmail i slično
	if strings.Contains(e, "535") || strings.Contains(e, "534") ||
		strings.Contains(e, "authentication failed") || strings.Contains(e, "username and password not accepted") ||
		strings.Contains(e, "smtp autentifikacija") {
		return "SMTP prijava nije uspela. Za Gmail obavezno app lozinka (ne obična), 2FA uključen. Proverite SMTP_USER i SMTP_PASS u Render Environment."
	}
	if strings.Contains(e, "starttls") || strings.Contains(e, "tls") && strings.Contains(e, "certificate") {
		return "Problem sa TLS/SMTP. Probajte SMTP_PORT=465 ili proverite SMTP_HOST."
	}
	// Resend: prikaži konkretnu poruku iz API-ja (ne zameni generičkim tekstom)
	if strings.Contains(e, "resend [") {
		out := err.Error()
		if len(out) > 900 {
			out = out[:900] + "…"
		}
		return out
	}
	if strings.Contains(e, "resend_from") || strings.Contains(e, "resend_api_key") {
		return err.Error()
	}

	return "Greška pri slanju poruke. U Render Dashboard → Logs potražite red sa [cena-zahtev] za tehnički detalj."
}
