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

	"beleg-app/backend/internal/debuglog"
	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

type expoMessage struct {
	To        string            `json:"to"`
	Title     string            `json:"title,omitempty"`
	Body      string            `json:"body,omitempty"`
	Data      map[string]string `json:"data,omitempty"`
	Sound     string            `json:"sound,omitempty"`
	Priority  string            `json:"priority,omitempty"`
	ChannelID string            `json:"channelId,omitempty"`
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

// PushTicketResult is the Expo push ticket outcome for one device token.
type PushTicketResult struct {
	Suffix       string `json:"suffix"`
	Platform     string `json:"platform,omitempty"`
	AppKind      string `json:"appKind,omitempty"`
	TicketStatus string `json:"ticketStatus"`
	TicketID     string `json:"ticketId,omitempty"`
	Error        string `json:"error,omitempty"`
	Message      string `json:"message,omitempty"`
}

type pushTarget struct {
	token    string
	platform string
	appKind  string
}

func tokenSuffix(tok string) string {
	tok = strings.TrimSpace(tok)
	if len(tok) <= 8 {
		return tok
	}
	return tok[len(tok)-8:]
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
	SendObavestenjeToUserWithData(db, userID, obavestenjeID, title, body, nil)
}

// SendObavestenjeToUserWithData kao SendObavestenjeToUser uz dodatni string data payload (Android/iOS Expo).
// Uvek uključuje obavestenjeId; extra ključevi se merge-uju (bez logovanja tokena).
func SendObavestenjeToUserWithData(db *gorm.DB, userID uint, obavestenjeID uint, title, body string, extra map[string]string) {
	if userID == 0 || obavestenjeID == 0 {
		return
	}

	var tokens []models.PushToken
	if err := db.Where("user_id = ?", userID).Find(&tokens).Error; err != nil || len(tokens) == 0 {
		// #region agent log
		debuglog.Log("expo.go:SendObavestenjeToUser", "no push tokens for user", "E", "pre-fix", map[string]interface{}{
			"userId": userID,
		})
		// #endregion
		return
	}

	targets := make([]pushTarget, 0, len(tokens))
	tokenMeta := make([]map[string]string, 0, len(tokens))
	for _, t := range tokens {
		if tok := strings.TrimSpace(t.Token); tok != "" {
			targets = append(targets, pushTarget{
				token:    tok,
				platform: t.Platform,
				appKind:  t.AppKind,
			})
			tokenMeta = append(tokenMeta, map[string]string{
				"platform": t.Platform,
				"appKind":  t.AppKind,
				"suffix":   debuglog.MaskToken(tok),
			})
		}
	}
	if len(targets) == 0 {
		return
	}

	// #region agent log
	debuglog.Log("expo.go:SendObavestenjeToUser", "sending push", "D", "pre-fix", map[string]interface{}{
		"userId":        userID,
		"obavestenjeId": obavestenjeID,
		"tokenCount":    len(targets),
		"tokens":        tokenMeta,
	})
	// #endregion

	data := map[string]string{
		"obavestenjeId": fmt.Sprintf("%d", obavestenjeID),
	}
	for k, v := range extra {
		if strings.TrimSpace(k) == "" {
			continue
		}
		data[k] = v
	}
	_, invalid, err := sendPushToTargets(targets, strings.TrimSpace(title), truncateBody(body, 200), data)
	if err != nil {
		log.Printf("push: send failed userId=%d obavestenjeId=%d: %v", userID, obavestenjeID, err)
		return
	}
	if len(invalid) > 0 {
		if err := db.Where("token IN ?", invalid).Delete(&models.PushToken{}).Error; err != nil {
			log.Printf("push: failed to delete invalid tokens: %v", err)
		}
	}
}

// SendTestPush šalje test push na zadate tokene i vraća Expo ticket rezultate (bez brisanja tokena).
func SendTestPush(tokens []models.PushToken, title, body string, data map[string]string) ([]PushTicketResult, error) {
	targets := make([]pushTarget, 0, len(tokens))
	for _, t := range tokens {
		if tok := strings.TrimSpace(t.Token); tok != "" {
			targets = append(targets, pushTarget{
				token:    tok,
				platform: t.Platform,
				appKind:  t.AppKind,
			})
		}
	}
	if len(targets) == 0 {
		return nil, fmt.Errorf("nema validnih push tokena")
	}
	results, _, err := sendPushToTargets(targets, title, body, data)
	return results, err
}

func sendPushToTargets(targets []pushTarget, title, body string, data map[string]string) ([]PushTicketResult, []string, error) {
	if len(targets) == 0 {
		return nil, nil, nil
	}

	messages := make([]expoMessage, 0, len(targets))
	for _, target := range targets {
		messages = append(messages, expoMessage{
			To:        target.token,
			Title:     title,
			Body:      body,
			Data:      data,
			Sound:     "default",
			Priority:  "high",
			ChannelID: "default",
		})
	}

	payload, err := json.Marshal(messages)
	if err != nil {
		log.Printf("push: marshal failed: %v", err)
		return nil, nil, fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, expoPushURL, bytes.NewReader(payload))
	if err != nil {
		log.Printf("push: request failed: %v", err)
		return nil, nil, fmt.Errorf("request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("push: send failed: %v", err)
		return nil, nil, fmt.Errorf("send failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("push: read response failed: %v", err)
		return nil, nil, fmt.Errorf("read response failed: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("push: expo returned %d: %s", resp.StatusCode, string(bodyBytes))
		return nil, nil, fmt.Errorf("expo returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var parsed expoResponse
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		log.Printf("push: parse response failed: %v", err)
		return nil, nil, fmt.Errorf("parse response failed: %w", err)
	}

	results := make([]PushTicketResult, 0, len(targets))
	var invalid []string
	for i, ticket := range parsed.Data {
		if i >= len(targets) {
			break
		}
		target := targets[i]
		result := PushTicketResult{
			Suffix:       tokenSuffix(target.token),
			Platform:     target.platform,
			AppKind:      target.appKind,
			TicketStatus: ticket.Status,
			TicketID:     ticket.ID,
			Message:      ticket.Message,
			Error:        ticket.Details.Error,
		}
		results = append(results, result)

		if ticket.Status == "ok" {
			// #region agent log
			debuglog.Log("expo.go:sendPush", "ticket ok", "D", "pre-fix", map[string]interface{}{
				"index":  i,
				"suffix": debuglog.MaskToken(target.token),
			})
			// #endregion
			continue
		}

		errCode := ticket.Details.Error
		// #region agent log
		debuglog.Log("expo.go:sendPush", "ticket error", "D", "pre-fix", map[string]interface{}{
			"index":   i,
			"suffix":  debuglog.MaskToken(target.token),
			"status":  ticket.Status,
			"message": ticket.Message,
			"error":   errCode,
		})
		// #endregion
		if errCode == "DeviceNotRegistered" || errCode == "InvalidCredentials" {
			invalid = append(invalid, target.token)
			continue
		}
		log.Printf("push: ticket error for token index %d: %s (%s)", i, ticket.Message, errCode)
	}
	return results, invalid, nil
}
