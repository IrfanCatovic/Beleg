package push

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

type expoMessage struct {
	To    string            `json:"to"`
	Title string            `json:"title,omitempty"`
	Body  string            `json:"body,omitempty"`
	Data  map[string]string `json:"data,omitempty"`
	Sound string            `json:"sound,omitempty"`
}

type expoTicket struct {
	Status  string `json:"status"`
	ID      string `json:"id,omitempty"`
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}

type expoResponse struct {
	Data []expoTicket `json:"data"`
}

func truncateBody(body string, max int) string {
	body = strings.TrimSpace(body)
	if len(body) <= max {
		return body
	}
	return body[:max-1] + "…"
}

// SendObavestenjeToUser šalje push obaveštenje na sve registrovane uređaje korisnika.
func SendObavestenjeToUser(db *gorm.DB, userID uint, obavestenjeID uint, title, body string) {
	if userID == 0 || obavestenjeID == 0 {
		return
	}

	var tokens []models.PushToken
	if err := db.Where("user_id = ?", userID).Find(&tokens).Error; err != nil || len(tokens) == 0 {
		return
	}

	tokenStrings := make([]string, 0, len(tokens))
	for _, t := range tokens {
		if tok := strings.TrimSpace(t.Token); tok != "" {
			tokenStrings = append(tokenStrings, tok)
		}
	}
	if len(tokenStrings) == 0 {
		return
	}

	data := map[string]string{
		"obavestenjeId": fmt.Sprintf("%d", obavestenjeID),
	}
	invalid := sendPush(tokenStrings, strings.TrimSpace(title), truncateBody(body, 200), data)
	if len(invalid) > 0 {
		if err := db.Where("token IN ?", invalid).Delete(&models.PushToken{}).Error; err != nil {
			log.Printf("push: failed to delete invalid tokens: %v", err)
		}
	}
}

func sendPush(tokens []string, title, body string, data map[string]string) []string {
	if len(tokens) == 0 {
		return nil
	}

	messages := make([]expoMessage, 0, len(tokens))
	for _, tok := range tokens {
		messages = append(messages, expoMessage{
			To:    tok,
			Title: title,
			Body:  body,
			Data:  data,
			Sound: "default",
		})
	}

	payload, err := json.Marshal(messages)
	if err != nil {
		log.Printf("push: marshal failed: %v", err)
		return nil
	}

	req, err := http.NewRequest(http.MethodPost, expoPushURL, bytes.NewReader(payload))
	if err != nil {
		log.Printf("push: request failed: %v", err)
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("push: send failed: %v", err)
		return nil
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("push: read response failed: %v", err)
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("push: expo returned %d: %s", resp.StatusCode, string(bodyBytes))
		return nil
	}

	var parsed expoResponse
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		log.Printf("push: parse response failed: %v", err)
		return nil
	}

	var invalid []string
	for i, ticket := range parsed.Data {
		if ticket.Status == "ok" {
			continue
		}
		if i >= len(tokens) {
			break
		}
		errCode := ticket.Details.Error
		if errCode == "DeviceNotRegistered" || errCode == "InvalidCredentials" {
			invalid = append(invalid, tokens[i])
			continue
		}
		log.Printf("push: ticket error for token index %d: %s (%s)", i, ticket.Message, errCode)
	}
	return invalid
}
