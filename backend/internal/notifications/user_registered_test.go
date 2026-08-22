package notifications

import (
	"encoding/json"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testUserRegisteredDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "user_registered_notify")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Klubovi{}, &models.Korisnik{}, &models.Obavestenje{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestNotifySuperadminsNewUser_InviteRegistration(t *testing.T) {
	db := testUserRegisteredDB(t)

	superadmin := models.Korisnik{Username: "super1", Password: "x", Role: "superadmin"}
	klub := models.Klubovi{Naziv: "PD Test"}
	if err := db.Create(&klub).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&superadmin).Error; err != nil {
		t.Fatal(err)
	}

	klubID := klub.ID
	newUser := models.Korisnik{
		Username: "novi_clan",
		Password: "x",
		Role:     "clan",
		FullName: "Novi Član",
		KlubID:   &klubID,
	}
	if err := db.Create(&newUser).Error; err != nil {
		t.Fatal(err)
	}

	NotifySuperadminsNewUser(db, newUser, UserRegistrationSourceInvite, klub.Naziv)

	var n models.Obavestenje
	if err := db.Where("user_id = ? AND type = ?", superadmin.ID, models.ObavestenjeTipUserRegistered).First(&n).Error; err != nil {
		t.Fatalf("expected notification: %v", err)
	}
	if n.Title != "Novi registrovani korisnik" {
		t.Fatalf("title=%q", n.Title)
	}
	if n.Link != BuildProfileNotificationLink(newUser.Username) {
		t.Fatalf("link=%q", n.Link)
	}

	var meta map[string]any
	if err := json.Unmarshal([]byte(n.Metadata), &meta); err != nil {
		t.Fatal(err)
	}
	if uint(meta["targetUserId"].(float64)) != newUser.ID {
		t.Fatalf("targetUserId=%v", meta["targetUserId"])
	}
	if meta["registrationSource"] != UserRegistrationSourceInvite {
		t.Fatalf("registrationSource=%v", meta["registrationSource"])
	}
}

func TestNotifySuperadminsNewUser_SkipsSuperadminBootstrap(t *testing.T) {
	db := testUserRegisteredDB(t)

	superadmin := models.Korisnik{Username: "super1", Password: "x", Role: "superadmin"}
	if err := db.Create(&superadmin).Error; err != nil {
		t.Fatal(err)
	}

	NotifySuperadminsNewUser(db, superadmin, UserRegistrationSourceAdmin, "")

	var count int64
	db.Model(&models.Obavestenje{}).Count(&count)
	if count != 0 {
		t.Fatalf("expected 0 notifications, got %d", count)
	}
}
