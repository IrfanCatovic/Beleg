package email

import (
	"crypto/tls"
	"fmt"
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
// Resend: RESEND_API_KEY, RESEND_FROM ("Ime <a@domen.com>"), EMAIL_TO (ili SMTP_USER kao primaoc).
//
// SMTP: SMTP_HOST, SMTP_PORT (podrazumevano 587), SMTP_USER, SMTP_PASS
//   - EMAIL_TO — primaoc(i); više adresa odvojeno zarezom; prazno = SMTP_USER
//   - EMAIL_FROM — adresa u From / envelope (podrazumevano SMTP_USER)
//   - SMTP_TLS_SKIP_VERIFY=true — samo za lokalni dev (ne na produkciji)
//
// Port 465: TLS od prvog bajta (SMTPS). Port 587/25: običan TCP pa STARTTLS ako server podržava.
func Send(subject, body string) error {
	if used, err := sendViaResendIfConfigured(subject, body); used {
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

	toRaw := strings.TrimSpace(os.Getenv("EMAIL_TO"))
	var toAddrs []string
	if toRaw == "" {
		toAddrs = []string{user}
	} else {
		for _, p := range strings.Split(toRaw, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				toAddrs = append(toAddrs, p)
			}
		}
		if len(toAddrs) == 0 {
			toAddrs = []string{user}
		}
	}

	from := strings.TrimSpace(os.Getenv("EMAIL_FROM"))
	if from == "" {
		from = user
	}

	toHeader := strings.Join(toAddrs, ", ")
	auth := smtp.PlainAuth("", user, pass, host)

	client, closeFn, err := dialSMTP(host, port)
	if err != nil {
		return err
	}
	defer closeFn()

	if ok, _ := client.Extension("AUTH"); ok {
		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP autentifikacija: %w", err)
		}
	}

	if err = client.Mail(from); err != nil {
		return fmt.Errorf("SMTP MAIL FROM: %w", err)
	}
	for _, addr := range toAddrs {
		if err = client.Rcpt(addr); err != nil {
			return fmt.Errorf("SMTP RCPT TO %s: %w", addr, err)
		}
	}

	w, err := client.Data()
	if err != nil {
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
	if timeout <= 0 {
		timeout = 25 * time.Second
	}
	ch := make(chan error, 1)
	go func() { ch <- Send(subject, body) }()
	select {
	case err := <-ch:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("SMTP nije odgovorio u roku od %v (proverite SMTP_HOST/PORT i mrežu servera)", timeout)
	}
}
