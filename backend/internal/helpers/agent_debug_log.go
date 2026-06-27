package helpers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// #region agent log
func AgentDebugLog(location, message, hypothesisID, runID string, data map[string]any) {
	payload := map[string]any{
		"sessionId":    "0764c5",
		"location":     location,
		"message":      message,
		"hypothesisId": hypothesisID,
		"runId":        runID,
		"data":         data,
		"timestamp":    time.Now().UnixMilli(),
	}
	line, err := json.Marshal(payload)
	if err != nil {
		return
	}
	paths := []string{
		"debug-0764c5.log",
		filepath.Join("..", "debug-0764c5.log"),
	}
	for _, p := range paths {
		f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			continue
		}
		_, _ = f.Write(append(line, '\n'))
		_ = f.Close()
		return
	}
}

// #endregion
