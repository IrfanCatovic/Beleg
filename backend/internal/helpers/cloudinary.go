package helpers

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

// Koliko dana čekamo pre brisanja zamenjene slike iz Cloudinary (praksa: 60 dana).
const CloudinaryDeleteAfterDays = 60

// CloudinaryFolderForClub vraća folder po klubu: Planiner/club-1, Planiner/club-2, ... (praksa: jedan folder po klubu).
// Za clubID 0 vraća "Planiner/club-0".
func CloudinaryFolderForClub(clubID uint) string {
	return fmt.Sprintf("Planiner/club-%d", clubID)
}

// CloudinaryFolderSetup za setup (prvi korisnik) i registraciju superadmina (nema klub).
func CloudinaryFolderSetup() string {
	return "Planiner/setup"
}

// Cloudinary URL: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public_id>.<ext>
// ili sa transformacijom: .../upload/<transform>/v<version>/<public_id>.<ext>
var cloudinaryVersionRe = regexp.MustCompile(`/v(\d+)/`)

// ExtractPublicIDFromURL izvlači Cloudinary public_id iz SecureURL.
// Vraća prazan string ako URL nije od našeg cloud-a ili nije validan.
func ExtractPublicIDFromURL(cloudName, secureURL string) string {
	if cloudName == "" || secureURL == "" {
		return ""
	}
	// Mora biti naš cloud
	if !strings.Contains(secureURL, "res.cloudinary.com/"+cloudName+"/") {
		return ""
	}
	idx := strings.Index(secureURL, "/image/upload/")
	if idx == -1 {
		return ""
	}
	suffix := secureURL[idx+len("/image/upload/"):]
	// Nađi v123456/ pa uzmi sve do kraja (to je public_id.ext)
	loc := cloudinaryVersionRe.FindStringIndex(suffix)
	if loc == nil {
		return ""
	}
	afterVersion := suffix[loc[1]:] // posle "v123456/"
	dot := strings.LastIndex(afterVersion, ".")
	if dot == -1 {
		return afterVersion
	}
	return afterVersion[:dot]
}

// ScheduleCloudinaryDeletion ako je oldURL od našeg Cloudinary-ja, upisuje ga u
// cloudinary_pending_deletes sa delete_after = now + 60 dana.
func ScheduleCloudinaryDeletion(db *gorm.DB, cloudName, oldURL string) {
	if oldURL == "" || cloudName == "" {
		return
	}
	publicID := ExtractPublicIDFromURL(cloudName, oldURL)
	if publicID == "" {
		return
	}
	deleteAfter := time.Now().AddDate(0, 0, CloudinaryDeleteAfterDays)
	rec := models.CloudinaryPendingDelete{
		PublicID:   publicID,
		DeleteAfter: deleteAfter,
	}
	if err := db.Create(&rec).Error; err != nil {
		// log ali ne fail-uj zahtev
		return
	}
}
