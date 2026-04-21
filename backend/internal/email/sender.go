package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"
)

// Send šalje običan tekstualni email.
// Ako je RESEND_API_KEY podešen, koristi se Resend HTTPS (preporuka za Railway itd.); inače SMTP.
//
// Resend: RESEND_API_KEY (+ EMAIL_TO ili SMTP_USER). RESEND_FROM opciono (podrazumevano onboarding@resend.dev za test).
//
// SMTP: SMTP_HOST, SMTP_PORT (podrazumevano 587), SMTP_USER, SMTP_PASS
//   - EMAIL_TO — primaoc(i); više adresa odvojeno zarezom; prazno = SMTP_USER
//   - EMAIL_FROM — adresa u From / envelope (podrazumevano SMTP_USER)
//   - SMTP_TLS_SKIP_VERIFY=true — samo za lokalni dev (ne na produkciji)
//
// Port 465: TLS od prvog bajta (SMTPS). Port 587/25: običan TCP pa STARTTLS ako server podržava.
func Send(subject, body string) error {
	return sendTo(defaultRecipients(), subject, body)
}

func SendToWithTimeout(toEmail, subject, body string, timeout time.Duration) error {
	to := strings.TrimSpace(toEmail)
	if to == "" {
		return fmt.Errorf("email primaoca je obavezan")
	}
	return sendToWithTimeout([]string{to}, subject, body, timeout)
}

func sendToWithTimeout(toAddrs []string, subject, body string, timeout time.Duration) error {
	if timeout <= 0 {
		timeout = 25 * time.Second
	}
	ch := make(chan error, 1)
	go func() { ch <- sendTo(toAddrs, subject, body) }()
	select {
	case err := <-ch:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("SMTP nije odgovorio u roku od %v (proverite SMTP_HOST/PORT i mrežu servera)", timeout)
	}
}

func defaultRecipients() []string {
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	toRaw := strings.TrimSpace(os.Getenv("EMAIL_TO"))
	var toAddrs []string
	if toRaw == "" {
		if user != "" {
			toAddrs = []string{user}
		}
		return toAddrs
	}
	for _, p := range strings.Split(toRaw, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			toAddrs = append(toAddrs, p)
		}
	}
	if len(toAddrs) == 0 && user != "" {
		toAddrs = []string{user}
	}
	return toAddrs
}

func sendTo(toAddrs []string, subject, body string) error {
	if len(toAddrs) == 0 {
		return fmt.Errorf("nije pronađena nijedna email adresa primaoca")
	}
	if used, err := sendViaResendIfConfigured(toAddrs, subject, body); used {
		return err
	}

	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := os.Getenv("SMTP_PASS")
	if host == "" || user == "" || pass == "" {
		return fmt.Errorf("email nije konfigurisan: postavite SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS u .env")
	}

	from := strings.TrimSpace(os.Getenv("EMAIL_FROM"))
	if from == "" {
		from = user
	}

	toHeader := strings.Join(toAddrs, ", ")
	auth := smtp.PlainAuth("", user, pass, host)
	client, closeFn, err := dialSMTP(host, port)
	if err != nil {
		log.Printf("email: SMTP konekcija na %s:%s nije uspela: %v", host, port, err)
		return err
	}
	defer closeFn()

	if ok, _ := client.Extension("AUTH"); ok {
		if err = client.Auth(auth); err != nil {
			log.Printf("email: SMTP AUTH na %s:%s nije uspeo: %v", host, port, err)
			return fmt.Errorf("SMTP autentifikacija: %w", err)
		}
	}

	if err = client.Mail(from); err != nil {
		log.Printf("email: SMTP MAIL FROM <%s> na %s:%s nije uspeo: %v", from, host, port, err)
		return fmt.Errorf("SMTP MAIL FROM: %w", err)
	}
	for _, addr := range toAddrs {
		if err = client.Rcpt(addr); err != nil {
			log.Printf("email: SMTP RCPT TO <%s> na %s:%s nije uspeo: %v", addr, host, port, err)
			return fmt.Errorf("SMTP RCPT TO %s: %w", addr, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		log.Printf("email: SMTP DATA (početak poruke) na %s:%s nije uspeo: %v", host, port, err)
		return fmt.Errorf("SMTP DATA: %w", err)
	}

	header := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n",
		from, toHeader, subject,
	)
	if _, err = w.Write([]byte(header + body)); err != nil {
		return err
	}
	if err = w.Close(); err != nil {
		log.Printf("email: SMTP završetak poruke (DATA .) na %s:%s nije uspeo: %v", host, port, err)
		return fmt.Errorf("završetak poruke: %w", err)
	}
	_ = client.Quit()
	return nil
}

func tlsConfig(host string) *tls.Config {
	cfg := &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	}
	if os.Getenv("SMTP_TLS_SKIP_VERIFY") == "true" {
		cfg.InsecureSkipVerify = true
	}
	return cfg
}

// Kratki dial timeout: na mnogim hostinzima (Railway, Render…) odlazni SMTP je blokiran —
// bez ovoga net.Dial može viseti minutima pre nego što spoljašnji SendWithTimeout odgovori.
func smtpDialer() *net.Dialer {
	return &net.Dialer{Timeout: 12 * time.Second}
}

func dialSMTP(host, port string) (*smtp.Client, func(), error) {
	addr := net.JoinHostPort(host, port)
	p, _ := strconv.Atoi(port)
	tlsCfg := tlsConfig(host)
	dialer := smtpDialer()

	// SMTPS (npr. Gmail/Outlook često nude 465)
	if p == 465 {
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsCfg)
		if err != nil {
			return nil, nil, fmt.Errorf("TLS konekcija na %s: %w", addr, err)
		}
		_ = conn.SetDeadline(time.Now().Add(60 * time.Second))
		client, err := smtp.NewClient(conn, host)
		if err != nil {
			conn.Close()
			return nil, nil, err
		}
		return client, func() { _ = client.Close() }, nil
	}

	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return nil, nil, fmt.Errorf("TCP konekcija na %s: %w", addr, err)
	}
	_ = conn.SetDeadline(time.Now().Add(60 * time.Second))
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		conn.Close()
		return nil, nil, err
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err = client.StartTLS(tlsCfg); err != nil {
			_ = client.Close()
			return nil, nil, fmt.Errorf("STARTTLS: %w", err)
		}
	}

	return client, func() { _ = client.Close() }, nil
}

// SendWithTimeout poziva Send u gorutini; ako SMTP ne odgovori u roku, vraća grešku (da HTTP zahtev ne visi beskonačno).
func SendWithTimeout(subject, body string, timeout time.Duration) error {
	return sendToWithTimeout(defaultRecipients(), subject, body, timeout)
}
