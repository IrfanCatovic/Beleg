package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// Ako je RESEND_API_KEY podešen, email ide preko HTTPS (pogodno za Railway/Render gde je odlazni SMTP često blokiran).
// RESEND_FROM — npr. "NaVrhu <noreply@tvoj-domen.com>" (mora verifikovan domen na resend.com)
// EMAIL_TO — primaoc(i), kao za SMTP
func sendViaResendIfConfigured(subject, body string) (bool, error) {
	key := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	if key == "" {
		return false, nil
	}

	from := strings.TrimSpace(os.Getenv("RESEND_FROM"))
	if from == "" {
		return true, fmt.Errorf("RESEND_API_KEY je podešen ali nedostaje RESEND_FROM (pošiljalac mora biti sa verifikovanog domena)")
	}

	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	toRaw := strings.TrimSpace(os.Getenv("EMAIL_TO"))
	var toAddrs []string
	if toRaw == "" {
		if user == "" {
			return true, fmt.Errorf("postavite EMAIL_TO ili SMTP_USER kao primaoca za Resend")
		}
		toAddrs = []string{user}
	} else {
		for _, p := range strings.Split(toRaw, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				toAddrs = append(toAddrs, p)
			}
		}
		if len(toAddrs) == 0 {
			return true, fmt.Errorf("EMAIL_TO nema validnih adresa")
		}
	}

	payload := map[string]any{
		"from":    from,
		"to":      toAddrs,
		"subject": subject,
		"text":    body,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return true, err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(raw))
	if err != nil {
		return true, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return true, fmt.Errorf("Resend HTTP: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return true, fmt.Errorf("Resend API %s: %s", resp.Status, strings.TrimSpace(string(respBody)))
	}
	return true, nil
}
