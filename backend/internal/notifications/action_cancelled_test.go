package notifications

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testNotifyDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:notify_" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}, &models.Obavestenje{}, &models.PushToken{}); err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func TestBuildActionCancelledBody(t *testing.T) {
	if got := BuildActionCancelledBody("", ""); got != "Planinarska akcija je otkazana." {
		t.Fatalf("empty: %q", got)
	}
	got := BuildActionCancelledBody("Durmitor", "Loši uslovi")
	if !strings.Contains(got, "Durmitor") || !strings.Contains(got, "Loši uslovi") {
		t.Fatalf("body=%q", got)
	}
	if strings.Contains(got, "<") || strings.Contains(got, "undefined") {
		t.Fatalf("unsafe body=%q", got)
	}
}

func TestNotifyActionCancelled_CreatesOnePerRecipient(t *testing.T) {
	db := testNotifyDB(t)
	users := make([]models.Korisnik, 3)
	for i := range users {
		users[i] = models.Korisnik{Username: fmt.Sprintf("n_u_%d", i), Password: "x"}
		if err := db.Create(&users[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	reason := "Bezbednosni razlozi"
	akcija := &models.Akcija{
		ID: 42, Naziv: "Komovi", CancellationReason: reason,
	}
	NotifyActionCancelled(db, akcija, []uint{users[0].ID, users[1].ID, users[2].ID})

	var count int64
	if err := db.Model(&models.Obavestenje{}).
		Where("type = ?", models.ObavestenjeTipActionCancelled).
		Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Fatalf("count=%d", count)
	}
	var sample models.Obavestenje
	if err := db.Where("user_id = ?", users[0].ID).First(&sample).Error; err != nil {
		t.Fatal(err)
	}
	if sample.Title != "Akcija otkazana" {
		t.Fatalf("title=%q", sample.Title)
	}
	if sample.Link != "/akcije/42" {
		t.Fatalf("link=%q", sample.Link)
	}
	if !strings.Contains(sample.Body, "Komovi") || !strings.Contains(sample.Body, reason) {
		t.Fatalf("body=%q", sample.Body)
	}
	if !strings.Contains(sample.Metadata, `"akcijaId":42`) {
		t.Fatalf("metadata=%q", sample.Metadata)
	}
	if sample.ReadAt != nil {
		t.Fatal("should be unread")
	}
	_ = time.Now()
}

func TestNotifyActionCancelled_EmptyRecipientsNoRows(t *testing.T) {
	db := testNotifyDB(t)
	NotifyActionCancelled(db, &models.Akcija{ID: 1, Naziv: "X", CancellationReason: "abc"}, nil)
	NotifyActionCancelled(db, &models.Akcija{ID: 1, Naziv: "X", CancellationReason: "abc"}, []uint{})
	var count int64
	db.Model(&models.Obavestenje{}).Count(&count)
	if count != 0 {
		t.Fatalf("count=%d", count)
	}
}

func TestNotifyActionCancelled_Batch500(t *testing.T) {
	db := testNotifyDB(t)
	ids := make([]uint, 0, 500)
	for i := 0; i < 500; i++ {
		u := models.Korisnik{Username: fmt.Sprintf("batch_%d", i), Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		ids = append(ids, u.ID)
	}
	NotifyActionCancelled(db, &models.Akcija{
		ID: 9, Naziv: "Masovna", CancellationReason: "Otkaz zbog vremena",
	}, ids)
	var count int64
	if err := db.Model(&models.Obavestenje{}).
		Where("type = ? AND link = ?", models.ObavestenjeTipActionCancelled, "/akcije/9").
		Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 500 {
		t.Fatalf("count=%d", count)
	}
}
