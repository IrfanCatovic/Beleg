package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type ferrataSnapshotPayload struct {
	Naziv              string   `json:"naziv"`
	Lokacija           string   `json:"lokacija"`
	Tezina             string   `json:"tezina"`
	TezinaOpcija       string   `json:"tezina_opcija"`
	DuzinaM            int      `json:"duzina_m"`
	VisinskaRazlikaM   int      `json:"visinska_razlika_m"`
	PrilazMin          int      `json:"prilaz_min"`
	TrajanjeMin        int      `json:"trajanje_min"`
	TrajanjeMax        int      `json:"trajanje_max"`
	PogodnoZaPocetnike string   `json:"pogodno_za_pocetnike"`
	ObaveznaOprema     []string `json:"obavezna_oprema"`
	Lat                *float64 `json:"lat,omitempty"`
	Lng                *float64 `json:"lng,omitempty"`
}

type ferrataOpremaItem struct {
	Label string `json:"label"`
	Icon  string `json:"icon"`
}

func displayFerrataRegion(f *models.Ferrata) string {
	a := strings.TrimSpace(f.GradOpstina)
	b := strings.TrimSpace(f.Drzava)
	if a != "" && b != "" {
		return a + ", " + b
	}
	if a != "" {
		return a
	}
	return b
}

func parseStringSliceJSON(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return []string{}
	}
	return out
}

func marshalGalleryJSON(urls []string) json.RawMessage {
	filtered := make([]string, 0, len(urls))
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u != "" {
			filtered = append(filtered, u)
		}
	}
	b, _ := json.Marshal(filtered)
	return json.RawMessage(b)
}

func buildFerrataSnapshotBytes(f *models.Ferrata) ([]byte, error) {
	labels := obaveznaOpremaLabels(f.ObaveznaOpremaJSON)
	p := ferrataSnapshotPayload{
		Naziv:              f.Naziv,
		Lokacija:           displayFerrataRegion(f),
		Tezina:             f.Tezina,
		TezinaOpcija:       f.TezinaOpcija,
		DuzinaM:            f.DuzinaM,
		VisinskaRazlikaM:   f.VisinskaRazlikaM,
		PrilazMin:          f.PrilazMin,
		TrajanjeMin:        f.TrajanjeMin,
		TrajanjeMax:        f.TrajanjeMax,
		PogodnoZaPocetnike: f.PogodnoZaPocetnike,
		ObaveznaOprema:     labels,
		Lat:                f.Lat,
		Lng:                f.Lng,
	}
	return json.Marshal(p)
}

func obaveznaOpremaLabels(raw json.RawMessage) []string {
	items := parseObaveznaOpremaItems(raw)
	out := make([]string, 0, len(items))
	for _, it := range items {
		if strings.TrimSpace(it.Label) != "" {
			out = append(out, strings.TrimSpace(it.Label))
		}
	}
	return out
}

func parseObaveznaOpremaItems(raw json.RawMessage) []ferrataOpremaItem {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var objs []ferrataOpremaItem
	if err := json.Unmarshal(raw, &objs); err == nil && len(objs) > 0 {
		// Novi format [{label, icon}, ...] ili prazan objekat
		if len(objs) > 1 || strings.TrimSpace(objs[0].Label) != "" || strings.TrimSpace(objs[0].Icon) != "" {
			return objs
		}
	}
	var strs []string
	if err := json.Unmarshal(raw, &strs); err == nil {
		out := make([]ferrataOpremaItem, 0, len(strs))
		for _, s := range strs {
			s = strings.TrimSpace(s)
			if s != "" {
				out = append(out, ferrataOpremaItem{Label: s})
			}
		}
		return out
	}
	return nil
}

func marshalObaveznaOpremaJSON(items []ferrataOpremaItem) json.RawMessage {
	filtered := make([]ferrataOpremaItem, 0, len(items))
	for _, it := range items {
		if strings.TrimSpace(it.Label) == "" {
			continue
		}
		filtered = append(filtered, ferrataOpremaItem{Label: strings.TrimSpace(it.Label), Icon: strings.TrimSpace(it.Icon)})
	}
	b, _ := json.Marshal(filtered)
	return json.RawMessage(b)
}

func obaveznaOpremaForAPI(raw json.RawMessage) []gin.H {
	items := parseObaveznaOpremaItems(raw)
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		if strings.TrimSpace(it.Label) == "" {
			continue
		}
		out = append(out, gin.H{"label": it.Label, "icon": strings.TrimSpace(it.Icon)})
	}
	return out
}

// Smeštaj u katalogu ferate više nije u upotrebi (hoteli + udaljenost); kolona ostaje u bazi.
var ferrataSmestajJSONEmpty = json.RawMessage([]byte("[]"))

func ferrataCoordJSON(v *float64) interface{} {
	if v == nil {
		return nil
	}
	return *v
}

// validateFerrataLatLngRequired glavna tačka ferate — potrebna za mapu i kasnije udaljenost do vodiča.
func validateFerrataLatLngRequired(lat, lng *float64) error {
	if lat == nil || lng == nil {
		return fmt.Errorf("Koordinate ferate (lat i lng) su obavezne")
	}
	if math.IsNaN(*lat) || math.IsInf(*lat, 0) || math.IsNaN(*lng) || math.IsInf(*lng, 0) {
		return fmt.Errorf("Koordinate nisu validne")
	}
	if *lat < -90 || *lat > 90 {
		return fmt.Errorf("Geografska širina (lat) mora biti između -90 i 90")
	}
	if *lng < -180 || *lng > 180 {
		return fmt.Errorf("Geografska dužina (lng) mora biti između -180 i 180")
	}
	return nil
}

func ferrataToMap(f *models.Ferrata, upcoming int64) gin.H {
	m := gin.H{
		"id":               f.ID,
		"naziv":            f.Naziv,
		"slug":             f.Slug,
		"drzava":           f.Drzava,
		"gradOpstina":      f.GradOpstina,
		"podrucje":         displayFerrataRegion(f),
		"opis":             f.Opis,
		"tezina":           f.Tezina,
		"tezinaOpcija":     f.TezinaOpcija,
		"duzinaM":          f.DuzinaM,
		"visinskaRazlikaM": f.VisinskaRazlikaM,
		"trajanjeMin":      f.TrajanjeMin,
		"trajanjeMax":      f.TrajanjeMax,
		"quickTip":         f.QuickTip,
		"lat":              ferrataCoordJSON(f.Lat),
		"lng":              ferrataCoordJSON(f.Lng),
		"highlights":       parseStringSliceJSON(f.HighlightsJSON),
		"okolina":          parseStringSliceJSON(f.OkolinaJSON),
		"galerija":         parseStringSliceJSON(f.GalerijaJSON),
		"obaveznaOprema":   obaveznaOpremaForAPI(f.ObaveznaOpremaJSON),
		"coverImage":       f.CoverImage,
		"mapNote":          strings.TrimSpace(f.MapNote),
		"status":           f.Status,
		"createdAt":        f.CreatedAt,
		"updatedAt":        f.UpdatedAt,
	}
	if upcoming >= 0 {
		m["upcomingActionsCount"] = upcoming
	}
	return m
}
