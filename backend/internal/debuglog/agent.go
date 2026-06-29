package debuglog

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

const sessionID = "2533bd"

type entry struct {
	SessionID    string                 `json:"sessionId"`
	RunID        string                 `json:"runId"`
	HypothesisID string                 `json:"hypothesisId"`
	Location     string                 `json:"location"`
	Message      string                 `json:"message"`
	Data         map[string]interface{} `json:"data"`
	Timestamp    int64                  `json:"timestamp"`
}

// Log appends one NDJSON line to debug-2533bd.log when writable (local dev).
func Log(location, message, hypothesisID, runID string, data map[string]interface{}) {
	if data == nil {
		data = map[string]interface{}{}
	}
	payload, err := json.Marshal(entry{
		SessionID:    sessionID,
		RunID:        runID,
		HypothesisID: hypothesisID,
		Location:     location,
		Message:      message,
		Data:         data,
		Timestamp:    time.Now().UnixMilli(),
	})
	if err != nil {
		return
	}
	paths := []string{
		"debug-2533bd.log",
		filepath.Join("..", "debug-2533bd.log"),
	}
	for _, p := range paths {
		f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			continue
		}
		_, _ = f.Write(append(payload, '\n'))
		_ = f.Close()
		return
	}
}

func MaskToken(tok string) string {
	tok = tok
	if len(tok) <= 12 {
		return "…"
	}
	return "…" + tok[len(tok)-8:]
}
