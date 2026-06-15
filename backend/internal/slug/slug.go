package slug

import (
	"fmt"
	"strings"
	"unicode"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

var serbianLatin = strings.NewReplacer(
	"Č", "c", "č", "c",
	"Ć", "c", "ć", "c",
	"Š", "s", "š", "s",
	"Ž", "z", "ž", "z",
	"Đ", "dj", "đ", "dj",
	"Dž", "dz", "dž", "dz",
)

// FromName pravi URL-deo iz naslova (mala slova, latinica, crtice).
func FromName(name string) string {
	s := strings.TrimSpace(name)
	if s == "" {
		return ""
	}
	s = serbianLatin.Replace(s)
	var b strings.Builder
	prevHyphen := false
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) && r < unicode.MaxASCII {
			if r >= 'a' && r <= 'z' {
				b.WriteRune(r)
				prevHyphen = false
				continue
			}
		}
		if unicode.IsDigit(r) {
			b.WriteRune(r)
			prevHyphen = false
			continue
		}
		if !prevHyphen && b.Len() > 0 {
			b.WriteByte('-')
			prevHyphen = true
		}
	}
	out := strings.Trim(b.String(), "-")
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	return out
}

// UniqueHotelSlug vraća jedinstven slug za hotels tabelu; excludeID 0 = novi zapis.
func UniqueHotelSlug(db *gorm.DB, naziv string, excludeID uint) (string, error) {
	base := FromName(naziv)
	if base == "" {
		base = "hotel"
	}
	for n := 0; n < 1000; n++ {
		candidate := base
		if n > 0 {
			candidate = fmt.Sprintf("%s-%d", base, n+1)
		}
		var count int64
		q := db.Model(&models.Hotel{}).Where("slug = ?", candidate)
		if excludeID > 0 {
			q = q.Where("id <> ?", excludeID)
		}
		if err := q.Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("slug: previše kolizija za bazu %q", base)
}

// UniquePeakSlug vraća jedinstven slug za peaks tabelu; excludeID 0 = novi zapis.
func UniquePeakSlug(db *gorm.DB, naziv string, excludeID uint) (string, error) {
	base := FromName(naziv)
	if base == "" {
		base = "vrh"
	}
	for n := 0; n < 1000; n++ {
		candidate := base
		if n > 0 {
			candidate = fmt.Sprintf("%s-%d", base, n+1)
		}
		var count int64
		q := db.Model(&models.Peak{}).Where("slug = ?", candidate)
		if excludeID > 0 {
			q = q.Where("id <> ?", excludeID)
		}
		if err := q.Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("slug: previše kolizija za bazu %q", base)
}

// UniqueFerrataSlug vraća jedinstven slug za ferratas tabelu; excludeID 0 = novi zapis.
func UniqueFerrataSlug(db *gorm.DB, naziv string, excludeID uint) (string, error) {
	base := FromName(naziv)
	if base == "" {
		base = "ferrata"
	}
	for n := 0; n < 1000; n++ {
		candidate := base
		if n > 0 {
			candidate = fmt.Sprintf("%s-%d", base, n+1)
		}
		var count int64
		q := db.Model(&models.Ferrata{}).Where("slug = ?", candidate)
		if excludeID > 0 {
			q = q.Where("id <> ?", excludeID)
		}
		if err := q.Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("slug: previše kolizija za bazu %q", base)
}
