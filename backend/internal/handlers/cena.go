package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/email"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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
	// Strukturisane javne forme (Kontakt / Cena stranica)
	ContactPerson   string `json:"contactPerson"`
	City            string `json:"city"`
	ClubMemberCount int    `json:"clubMemberCount"`
	AdminUsername   string `json:"adminUsername"`
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
	paketNorm := strings.TrimSpace(req.Paket)
	isKontaktForma := strings.EqualFold(paketNorm, "Kontakt forma") ||
		strings.EqualFold(paketNorm, "Kontaktformular") ||
		strings.EqualFold(paketNorm, "Contact form")
	isCenaStranicaForma := strings.EqualFold(paketNorm, "Cena stranica")
	isSimplePublicForma := isKontaktForma || isCenaStranicaForma
	structuredPublic := isSimplePublicForma && strings.TrimSpace(req.ContactPerson) != ""

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	if imeKluba == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno unesite ime kluba"})
		return
	}

	if structuredPublic {
		if emailStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno unesite email"})
			return
		}
		city := strings.TrimSpace(req.City)
		question := strings.TrimSpace(req.Note)
		adminUser := helpers.NormalizeUsername(req.AdminUsername)
		if strings.TrimSpace(req.ContactPerson) == "" || city == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Molimo popunite sva obavezna polja."})
			return
		}
		if question == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite pitanje ili poruku."})
			return
		}
		if req.ClubMemberCount < 1 || req.ClubMemberCount > 500000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite realan broj članova kluba (1–500000)."})
			return
		}
		if adminUser == "" || len(adminUser) < 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unesite korisničko ime za prvog admina (min. 2 karaktera)."})
			return
		}
		var taken models.Korisnik
		usernameTakenErr := helpers.DBWhereUsername(db, adminUser).First(&taken).Error
		if usernameTakenErr == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim korisničkim imenom već postoji. Izaberite drugo korisničko ime."})
			return
		}
		if !errors.Is(usernameTakenErr, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri korisničkog imena"})
			return
		}
		if phoneStr == "" {
			if isCenaStranicaForma {
				phoneStr = "(nije unet – stranica Cena)"
			} else {
				phoneStr = "(nije unet – stranica Kontakt)"
			}
		}
	} else if !isSimplePublicForma {
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
			if isCenaStranicaForma {
				emailStr = "(nije unet – stranica Cena)"
			} else {
				emailStr = "(nije unet – stranica Kontakt)"
			}
		}
		if phoneStr == "" {
			if isCenaStranicaForma {
				phoneStr = "(nije unet – stranica Cena)"
			} else {
				phoneStr = "(nije unet – stranica Kontakt)"
			}
		}
	}

	subject := "NaVrhu – zahtev za ponudu (paket " + req.Paket + ")"
	if isKontaktForma {
		subject = "Nova zahtev za ponudu sa stranice Kontakt"
	} else if isCenaStranicaForma {
		subject = "Upit za registraciju kluba – stranica Cena (NaVrhu)"
	}

	body := buildCenaEmailBody(req, imeKluba, emailStr, phoneStr, isKontaktForma, isCenaStranicaForma)

	if err := email.SendWithTimeout(subject, body, 25*time.Second); err != nil {
		log.Printf("[cena-zahtev] greška pri slanju emaila: %v", err)
		msg := humanizeEmailSendError(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	log.Printf("[cena-zahtev] email uspešno poslat (klub=%s, paket=%s)", imeKluba, req.Paket)
	c.JSON(http.StatusOK, gin.H{"message": "Poruka je uspešno poslata. Javit ćemo vam se uskoro."})
}

func parseKontaktNote(note string) (imeKlubaNote, kontaktOsoba, mesto, pitanje string) {
	// Frontend šalje note u formatu:
	// Pitanje poslato sa stranice Kontakt:
	// Kontakt osoba: ...
	// Ime kluba: ...
	// Mesto: ...
	// Pitanje:
	// ...
	note = strings.ReplaceAll(note, "\r\n", "\n")
	note = strings.TrimSpace(note)

	getLineValue := func(label string) string {
		idx := strings.Index(note, label)
		if idx < 0 {
			return ""
		}
		after := strings.TrimSpace(note[idx+len(label):])
		// Ukloni eventualno prefiks “:” (npr. label uključuje “Kontakt osoba:”)
		// ovde label standardno već uključuje “:”.
		// Uzmi do prvog newline-a.
		parts := strings.SplitN(after, "\n", 2)
		return strings.TrimSpace(parts[0])
	}

	// labeli moraju tačno odgovarati tekstu iz frontenda
	kontaktOsoba = getLineValue("Kontakt osoba:")
	imeKlubaNote = getLineValue("Ime kluba:")
	mesto = getLineValue("Mesto:")

	qLabel := "Pitanje:"
	qIdx := strings.Index(note, qLabel)
	if qIdx >= 0 {
		pitanje = strings.TrimSpace(note[qIdx+len(qLabel):])
	}
	return imeKlubaNote, kontaktOsoba, mesto, pitanje
}

func buildCenaEmailBody(
	req CenaZahtevRequest,
	imeKluba,
	emailStr,
	phoneStr string,
	isKontaktForma, isCenaStranicaForma bool,
) string {
	if isKontaktForma || isCenaStranicaForma {
		if strings.TrimSpace(req.ContactPerson) != "" {
			headline := "Nova zahtev sa stranice Kontakt"
			if isCenaStranicaForma {
				headline = "Upit sa stranice Cena – registracija planinarskog kluba (besplatno)"
			}
			var b strings.Builder
			b.WriteString(headline + "\n\n")
			b.WriteString("---\n")
			b.WriteString(fmt.Sprintf("Ime kluba: %s\n", imeKluba))
			b.WriteString(fmt.Sprintf("Kontakt osoba: %s\n", strings.TrimSpace(req.ContactPerson)))
			b.WriteString(fmt.Sprintf("Email: %s\n", emailStr))
			b.WriteString(fmt.Sprintf("Mesto: %s\n", strings.TrimSpace(req.City)))
			b.WriteString(fmt.Sprintf("Broj članova kluba: %d\n", req.ClubMemberCount))
			b.WriteString(fmt.Sprintf("Korisničko ime prvog admina: %s\n", helpers.NormalizeUsername(req.AdminUsername)))
			b.WriteString("Pitanje za nas:\n" + strings.TrimSpace(req.Note) + "\n")
			b.WriteString("---\n")
			b.WriteString("Telefon: " + phoneStr + "\n")
			return b.String()
		}

		imeKlubaNote, kontakt, mesto, pitanje := parseKontaktNote(req.Note)
		imeKlubaFinal := imeKluba
		if imeKlubaNote != "" {
			imeKlubaFinal = imeKlubaNote
		}

		headline := "Nova zahtev za ponudu sa stranice Kontakt"
		if isCenaStranicaForma {
			headline = "Upit sa stranice Cena – registracija planinarskog kluba (besplatno)"
		}

		// Ako parse nije uspeo iz nekog razloga, vrati barem note u “fallback” formatu.
		if kontakt == "" || mesto == "" || pitanje == "" {
			var b strings.Builder
			b.WriteString(headline + "\n\n")
			b.WriteString("---\n")
			b.WriteString("Ime kluba: " + imeKlubaFinal + "\n\n")
			if req.Note != "" {
				b.WriteString("Pitanje:\n" + req.Note + "\n")
			}
			b.WriteString("---\n")
			return b.String()
		}

		var b strings.Builder
		b.WriteString(headline + "\n\n")
		b.WriteString("---\n")
		b.WriteString(fmt.Sprintf("Ime kluba: %s\n", imeKlubaFinal))
		b.WriteString(fmt.Sprintf("Kontakt osoba: %s\n", kontakt))
		b.WriteString(fmt.Sprintf("Mesto: %s\n", mesto))
		b.WriteString("Pitanje za nas:\n" + pitanje + "\n")
		b.WriteString("---\n")
		return b.String()
	}

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
