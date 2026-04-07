package config

import (
	"os"
	"strings"
)

// defaultOrigins are always allowed (local + hard fallback domains).
var defaultOrigins = []string{
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://planiner.com",
	"https://www.planiner.com",
}

// getEnvOrDefault returns env value or a fallback when env is empty.
func getEnvOrDefault(envVar string, defaultValue string) string {
	value := os.Getenv(envVar)
	if value == "" {
		return defaultValue
	}
	return value
}

// prepareOriginSet seeds a lookup map with default origins (dedupe base).
func prepareOriginSet() map[string]bool {
	originSet := map[string]bool{}
	for _, origin := range defaultOrigins {
		originSet[origin] = true
	}
	return originSet
}

// corsOriginsString reads CORS_ORIGINS, or defaults to CSV(defaultOrigins).
func corsOriginsString() string {
	defaultCSV := strings.Join(defaultOrigins, ",")
	return getEnvOrDefault("CORS_ORIGINS", defaultCSV)
}

// parseExtraOriginsFromCORSString parses CSV, trims values, skips empty/duplicate entries.
func parseExtraOriginsFromCORSString(corsOrigins string, originSet map[string]bool) []string {
	var extra []string
	for _, o := range strings.Split(corsOrigins, ",") {
		o = strings.TrimSpace(o)
		if o == "" || originSet[o] {
			continue
		}
		originSet[o] = true
		extra = append(extra, o)
	}
	return extra
}

// getCORSOrigins builds the final allow-list: defaults first, then unique extras from env.
func getCORSOrigins() []string {
	corsOrigins := corsOriginsString()
	originSet := prepareOriginSet()
	extra := parseExtraOriginsFromCORSString(corsOrigins, originSet)
	return append(defaultOrigins, extra...)
}

// BuildAllowedOrigins is the exported entrypoint used by main/router setup.
func BuildAllowedOrigins() []string {
	return getCORSOrigins()
}


