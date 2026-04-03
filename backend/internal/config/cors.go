// package config

// import (
// 	"os"
// 	"strings"
// )


// var defaultOrigins = []string{
// 	"http://localhost:5173",
// 	"http://127.0.0.1:5173",
// 	"https://planiner.com",
// 	"https://www.planiner.com",
// }

// func getEnvOrDefault(envVar string, defaultValue string) string {
// 	value := os.Getenv(envVar)
// 	if value == "" {
// 		return defaultValue
// 	}
// 	return value
// }

// func prepareOriginSet() map[string]bool {
// 	originSet := map[string]bool{}
// 	for _, origin := range defaultOrigins {
// 		originSet[origin] = true
// 	}
// 	return originSet
// }

// func corsOriginsString() string {
// 	defaultCSV := strings.Join(defaultOrigins, ",")
// 	return getEnvOrDefault("CORS_ORIGINS", defaultCSV)
// }
// func parseExtraOriginsFromCORSString(corsOrigins string, originSet map[string]bool) []string {
// 	var extra []string
// 	for _, o := range strings.Split(corsOrigins, ",") {
// 		o = strings.TrimSpace(o)
// 		if o == "" || originSet[o] {
// 			continue
// 		}
// 		originSet[o] = true
// 		extra = append(extra, o)
// 	}
// 	return extra
// }

// // KORAK 6:
// // Ovde napravi finalnu listu origin-a:
// // prvo default lista, zatim dodatni (custom) origin-i.
// // Time zadrzavas stabilan i predvidiv redosled.

// // KORAK 7:
// // Ovde vrati finalnu listu origin-a iz funkcije.
// // Funkcija treba da ima jasan ulaz i izlaz (idealno []string kao rezultat).

// // KORAK 8:
// // Ovde (opciono) dodaj kratku validaciju origin formata.
// // Na primer: ignorisi vrednosti bez protokola (http/https), ako to zelis.

// // KORAK 9:
// // Ovde (opciono) dodaj mini helper funkcije ako osetis da je citljivije:
// // - getEnvOrDefault(...)
// // - splitAndClean(...)
// // - dedupe(...)
// // Prvo napravi da radi, pa tek onda deli na manje helper-e.

