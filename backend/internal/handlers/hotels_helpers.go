package handlers

import (
	"encoding/json"
	"strings"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func hotelSlikeFromJSON(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return []string{}
	}
	res := make([]string, 0, len(out))
	for _, u := range out {
		t := strings.TrimSpace(u)
		if t != "" {
			res = append(res, t)
		}
	}
	return res
}

func marshalHotelSlikeJSON(urls []string) []byte {
	if urls == nil {
		urls = []string{}
	}
	clean := make([]string, 0, len(urls))
	for _, u := range urls {
		t := strings.TrimSpace(u)
		if t != "" {
			clean = append(clean, t)
		}
	}
	b, _ := json.Marshal(clean)
	return b
}

func hotelToMap(h *models.Hotel) gin.H {
	return gin.H{
		"id":           h.ID,
		"naziv":        h.Naziv,
		"slug":         h.Slug,
		"lat":          h.Lat,
		"lng":          h.Lng,
		"opis":         h.Opis,
		"telefon":      h.Telefon,
		"status":       h.Status,
		"slike":        hotelSlikeFromJSON(h.SlikeJSON),
		"bookingUrl":   strings.TrimSpace(h.BookingURL),
		"instagramUrl": strings.TrimSpace(h.InstagramURL),
		"createdAt":    h.CreatedAt,
		"updatedAt":    h.UpdatedAt,
	}
}
