package notifications

import (
	"fmt"
	"strings"

	"beleg-app/backend/internal/models"

	"gorm.io/gorm"
)

const (
	UserRegistrationSourceOpen  = "open"
	UserRegistrationSourceInvite = "invite"
	UserRegistrationSourceAdmin = "admin"
)

// NotifySuperadminsNewUser obaveštava sve superadmin naloge o novom korisniku (in-app + push).
// Best-effort: greške se loguju unutar NotifyUsers i ne prekidaju registraciju.
func NotifySuperadminsNewUser(db *gorm.DB, user models.Korisnik, source string, clubName string) {
	if user.ID == 0 || user.Role == "superadmin" {
		return
	}

	var superadminIDs []uint
	if err := db.Model(&models.Korisnik{}).
		Where("role = ? AND id <> ?", "superadmin", user.ID).
		Pluck("id", &superadminIDs).Error; err != nil || len(superadminIDs) == 0 {
		return
	}

	displayName := strings.TrimSpace(user.FullName)
	if displayName == "" {
		displayName = user.Username
	}

	clubLabel := strings.TrimSpace(clubName)
	if clubLabel == "" && user.KlubID != nil && *user.KlubID > 0 {
		var klub models.Klubovi
		if err := db.Select("naziv").First(&klub, *user.KlubID).Error; err == nil {
			clubLabel = strings.TrimSpace(klub.Naziv)
		}
	}

	title := "Novi registrovani korisnik"
	body := buildNewUserNotificationBody(displayName, user.Username, source, clubLabel)

	meta := ProfileNotificationMetadata(user.ID, user.Username, map[string]any{
		"registrationSource": source,
		"role":               user.Role,
	})
	if clubLabel != "" {
		meta["clubName"] = clubLabel
	}
	if user.KlubID != nil && *user.KlubID > 0 {
		meta["clubId"] = *user.KlubID
	}

	NotifyUsers(
		db,
		superadminIDs,
		models.ObavestenjeTipUserRegistered,
		title,
		body,
		BuildProfileNotificationLink(user.Username),
		MarshalMetadata(meta),
	)
}

func buildNewUserNotificationBody(displayName, username, source, clubName string) string {
	handle := "@" + username
	switch source {
	case UserRegistrationSourceInvite:
		if clubName != "" {
			return fmt.Sprintf("%s (%s) se registrovao u klub %s putem invite koda.", displayName, handle, clubName)
		}
		return fmt.Sprintf("%s (%s) se registrovao putem invite koda.", displayName, handle)
	case UserRegistrationSourceAdmin:
		if clubName != "" {
			return fmt.Sprintf("%s (%s) je dodat u klub %s od strane admina/sekretara.", displayName, handle, clubName)
		}
		return fmt.Sprintf("%s (%s) je dodat od strane admina/sekretara.", displayName, handle)
	default:
		return fmt.Sprintf("%s (%s) se registrovao (open registracija, bez kluba).", displayName, handle)
	}
}
