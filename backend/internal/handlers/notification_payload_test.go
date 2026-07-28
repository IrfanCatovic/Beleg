package handlers

import (
	"encoding/json"
	"strconv"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/internal/testdb"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testNotificationPayloadDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "notif_payload")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Klubovi{}, &models.Korisnik{}, &models.Akcija{}, &models.Post{}, &models.Obavestenje{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestFollowRequestNotification_ActorProfileLinkAndMetadata(t *testing.T) {
	db := testNotificationPayloadDB(t)
	actor := models.Korisnik{Username: "actor+plus", Password: "x", Role: "clan"}
	recipient := models.Korisnik{Username: "recipient", Password: "x", Role: "clan"}
	if err := db.Create(&actor).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&recipient).Error; err != nil {
		t.Fatal(err)
	}

	meta := notifications.ProfileNotificationMetadata(actor.ID, actor.Username, map[string]any{
		"followId":          uint(1),
		"requesterId":       actor.ID,
		"requesterUsername": actor.Username,
	})
	notifications.NotifyUsers(
		db,
		[]uint{recipient.ID},
		models.ObavestenjeTipFollow,
		"Novi zahtev za praćenje",
		"actor želi da te zaprati.",
		notifications.BuildProfileNotificationLink(actor.Username),
		notifications.MarshalMetadata(meta),
	)

	var n models.Obavestenje
	if err := db.Where("user_id = ?", recipient.ID).First(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n.UserID != recipient.ID {
		t.Fatalf("recipient=%d got user_id=%d", recipient.ID, n.UserID)
	}
	wantLink := notifications.BuildProfileNotificationLink(actor.Username)
	if n.Link != wantLink {
		t.Fatalf("link=%q want %q", n.Link, wantLink)
	}
	if strings.Contains(n.Link, recipient.Username) {
		t.Fatalf("link must not point to recipient profile: %q", n.Link)
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(n.Metadata), &parsed); err != nil {
		t.Fatal(err)
	}
	if got := uint(parsed["targetUserId"].(float64)); got != actor.ID {
		t.Fatalf("targetUserId=%d want %d", got, actor.ID)
	}
}

func TestMentionNotification_HomeLinkNotRecipientProfile(t *testing.T) {
	db := testNotificationPayloadDB(t)
	klub := models.Klubovi{Naziv: "K"}
	if err := db.Create(&klub).Error; err != nil {
		t.Fatal(err)
	}
	klubID := klub.ID
	sender := models.Korisnik{Username: "sender", Password: "x", Role: "clan", KlubID: &klubID}
	mentioned := models.Korisnik{Username: "mentioned", Password: "x", Role: "clan", KlubID: &klubID}
	for _, u := range []*models.Korisnik{&sender, &mentioned} {
		if err := db.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}
	post := models.Post{UserID: sender.ID, AuthorID: sender.ID, ClubID: klubID, Content: "hello @mentioned"}
	if err := db.Create(&post).Error; err != nil {
		t.Fatal(err)
	}

	notifyMentionsFromContent(db, []string{"mentioned"}, sender, "hello @mentioned", sender.ID, post.ID, klubID)

	var n models.Obavestenje
	if err := db.Where("user_id = ?", mentioned.ID).First(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n.Link != notifications.BuildHomeNotificationLink() {
		t.Fatalf("link=%q want /home", n.Link)
	}
	if strings.Contains(n.Link, "/korisnik/") {
		t.Fatalf("mention must not link to profile: %q", n.Link)
	}
	if !strings.Contains(n.Metadata, `"postId"`) {
		t.Fatalf("metadata=%q", n.Metadata)
	}
	if strings.Contains(n.Link, mentioned.Username) {
		t.Fatalf("link must not contain recipient username")
	}
}

func TestGuideBookingFulfilled_ActionLinkWhenActionIDPresent(t *testing.T) {
	db := testNotificationPayloadDB(t)
	requester := models.Korisnik{Username: "req", Password: "x", Role: "clan"}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}
	actionID := uint(42)
	meta := notifications.ActionNotificationMetadata(actionID, map[string]any{
		"bookingKind": "ferrata",
		"status":      models.GuideBookingTargetStatusAccepted,
	})
	notifications.NotifyUsers(
		db,
		[]uint{requester.ID},
		models.ObavestenjeTipGuideBookingRequest,
		"Akcija je kreirana za vaš zahtev",
		"body",
		notifications.BuildActionNotificationLink(actionID, false),
		notifications.MarshalMetadata(meta),
	)

	var n models.Obavestenje
	if err := db.First(&n).Error; err != nil {
		t.Fatal(err)
	}
	want := "/akcije/" + strconv.FormatUint(uint64(actionID), 10)
	if n.Link != want {
		t.Fatalf("link=%q want %q", n.Link, want)
	}
}

func TestGuideBookingRejected_EmptyLinkFallback(t *testing.T) {
	db := testNotificationPayloadDB(t)
	requester := models.Korisnik{Username: "req", Password: "x", Role: "clan"}
	if err := db.Create(&requester).Error; err != nil {
		t.Fatal(err)
	}
	meta := map[string]any{
		"bookingKind": "peak",
		"status":      models.GuideBookingTargetStatusRejected,
	}
	notifications.NotifyUsers(
		db,
		[]uint{requester.ID},
		models.ObavestenjeTipGuideBookingRequest,
		"Zahtev za vođenje je odbijen",
		"body",
		"",
		notifications.MarshalMetadata(meta),
	)

	var n models.Obavestenje
	if err := db.First(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n.Link != "" {
		t.Fatalf("link=%q want empty", n.Link)
	}
}

func TestParticipationRequestNotification_CanonicalPayload(t *testing.T) {
	db := testNotificationPayloadDB(t)
	klub := models.Klubovi{Naziv: "Host"}
	if err := db.Create(&klub).Error; err != nil {
		t.Fatal(err)
	}
	klubID := klub.ID
	admin := models.Korisnik{Username: "admin", Password: "x", Role: "vodic", KlubID: &klubID}
	otherKlub := klubID + 1
	target := models.Korisnik{Username: "target", Password: "x", Role: "clan", KlubID: &otherKlub}
	for _, row := range []any{&admin, &target} {
		if err := db.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	akcija := models.Akcija{
		Naziv: "Done", Datum: time.Now().Add(-24 * time.Hour), IsCompleted: true,
		KlubID: &klubID, VodicID: admin.ID, AddedByID: admin.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	req := models.ActionParticipationRequest{
		ID:            99,
		AkcijaID:      akcija.ID,
		TargetUserID:  target.ID,
		RequestedByID: admin.ID,
		Status:        models.ActionParticipationRequestPending,
		Akcija:        akcija,
		RequestedBy:   admin,
		TargetUser:    target,
	}
	createActionParticipationRequestNotification(db, req)

	var n models.Obavestenje
	if err := db.Where("user_id = ?", target.ID).First(&n).Error; err != nil {
		t.Fatal(err)
	}
	wantLink := "/akcije/" + strconv.FormatUint(uint64(akcija.ID), 10)
	if n.Link != wantLink {
		t.Fatalf("link=%q want %q", n.Link, wantLink)
	}
	if !strings.Contains(n.Metadata, `"requestId"`) {
		t.Fatalf("metadata=%q", n.Metadata)
	}
}
