package email

import (
	"fmt"
	"net/smtp"
	"os"
	"strings"
)

// Send sends a plain text email to the configured recipient.
// Uses SMTP env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_TO.
// If EMAIL_TO is empty, falls back to SMTP_USER.
func Send(subject, body string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	to := strings.TrimSpace(os.Getenv("EMAIL_TO"))
	if to == "" {
		to = user
	}

	if host == "" || port == "" || user == "" || pass == "" {
		return fmt.Errorf("email nije konfigurisan: postavite SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS u .env")
	}

	addr := host + ":" + port
	auth := smtp.PlainAuth("", user, pass, host)

	from := user
	header := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n",
		from, to, subject)
	msg := []byte(header + body)

	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}
