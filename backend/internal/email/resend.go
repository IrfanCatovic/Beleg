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

// Ako je RESEND_API_KEY podešen, email ide preko HTTPS (pogodno za Render gde je odlazni SMTP često blokiran).
//
// Minimalno na Renderu: RESEND_API_KEY + EMAIL_TO (ili SMTP_USER kao primaoc).
// RESEND_FROM — opciono; ako je prazno: Planiner <onboarding@resend.dev> (test: primaoc mora biti email isti kao Resend nalog, ili verifikuj domen).
// Za produkciju: verifikuj domen na resend.com i postavi npr. "Planiner <noreply@tvoj-domen.com>".
func sendViaResendIfConfigured(subject, body string) (bool, error) {
	key := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	key = strings.TrimPrefix(key, "Bearer ")
	key = strings.TrimSpace(key)
	if key == "" {
		return false, nil
	}

	from := strings.TrimSpace(os.Getenv("RESEND_FROM"))
	if from == "" {
		// Format "Ime <email>" kao u Resend dokumentaciji
		from = "Planiner <onboarding@resend.dev>"
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
		return true, resendHTTPError(resp.StatusCode, respBody)
	}
	return true, nil
}

// resendHTTPError parsira JSON od Resend-a da korisnik vidi stvaran razlog (403 „samo na svoj email“, nevažeći API ključ, itd.).
func resendHTTPError(status int, body []byte) error {
	raw := strings.TrimSpace(string(body))
	msg := parseResendJSONMessage(body)
	if msg == "" {
		msg = raw
	}
	if msg == "" {
		msg = "nepoznata greška"
	}
	hint := ""
	low := strings.ToLower(msg)
	if strings.Contains(low, "only send testing emails to your own") || strings.Contains(low, "verify a domain") {
		hint = " Sa onboarding@resend.dev EMAIL_TO na Renderu mora biti isti email kao nalog na resend.com. Za druge primače verifikuj domen i RESEND_FROM."
	}
	if status == 401 || status == 403 {
		if strings.Contains(low, "api key") || strings.Contains(low, "invalid") {
			hint += " Proverite RESEND_API_KEY (ceo ključ re_..., bez razmaka i bez navodnika u Render env)."
		}
	}
	return fmt.Errorf("Resend [%d]: %s%s", status, msg, hint)
}

func parseResendJSONMessage(body []byte) string {
	var m struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(body, &m) == nil && strings.TrimSpace(m.Message) != "" {
		return strings.TrimSpace(m.Message)
	}
	return ""
}
