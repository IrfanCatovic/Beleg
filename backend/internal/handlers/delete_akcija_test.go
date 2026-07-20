package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testDeleteAkcijaDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.Akcija{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.ActionSignupRequest{},
		&models.ActionInviteLink{},
		&models.ActionParticipationRequest{},
		&models.GuideActionRating{},
		&models.AkcijaSmestaj{},
		&models.AkcijaPrevoz{},
		&models.AkcijaOprema{},
		&models.AkcijaOpremaRent{},
		&models.FerrataGuideBookingRequest{},
		&models.FerrataGuideBookingTarget{},
		&models.PeakGuideBookingRequest{},
		&models.PeakGuideBookingTarget{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := database.PostAutoMigrateCreatePrijavaIndexes(db); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
}

func callDeleteAkcija(t *testing.T, db *gorm.DB, akcijaID uint, username, role string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10), nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	DeleteAkcija(c)
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body
}

func countWhere(t *testing.T, db *gorm.DB, model any, query string, args ...any) int64 {
	t.Helper()
	var n int64
	if err := db.Model(model).Where(query, args...).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func TestDeleteAkcija_EmptyAction(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner1", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Empty", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 0 {
		t.Fatal("akcija should be deleted")
	}
}

func TestDeleteAkcija_RemovesAllDirectChildren(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner2", Password: "x", Role: "vodic"}
	member := models.Korisnik{Username: "member2", Password: "x", Role: "clan"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Full", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}

	prijava := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	if err := db.Create(&prijava).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: prijava.ID, SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}

	for _, st := range []string{
		models.ActionSignupRequestPending,
		models.ActionSignupRequestAccepted,
		models.ActionSignupRequestRejected,
		models.ActionSignupRequestCancelled,
	} {
		u := models.Korisnik{Username: "sr-" + st, Password: "x"}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.ActionSignupRequest{
			AkcijaID: akcija.ID, RequesterID: u.ID, Status: st,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	if err := db.Create(&models.ActionInviteLink{
		AkcijaID: akcija.ID, TokenHash: "hash-delete-1",
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionParticipationRequest{
		AkcijaID: akcija.ID, TargetUserID: member.ID, RequestedByID: owner.ID,
		Status: models.ActionParticipationRequestPending,
	}).Error; err != nil {
		t.Fatal(err)
	}

	smestaj := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "Hotel", CenaPoOsobiUkupno: 10}
	if err := db.Create(&smestaj).Error; err != nil {
		t.Fatal(err)
	}
	oprema := models.AkcijaOprema{AkcijaID: akcija.ID, Naziv: "Štap"}
	if err := db.Create(&oprema).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.AkcijaOpremaRent{
		AkcijaID: akcija.ID, AkcijaOpremaID: &oprema.ID, NazivOpreme: "Štap", DostupnaKolicina: 2,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.AkcijaPrevoz{
		AkcijaID: akcija.ID, TipPrevoza: "autobus", NazivGrupe: "A", Kapacitet: 10,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.GuideActionRating{
		AkcijaID: akcija.ID, RaterKorisnikID: member.ID, GuideProfileID: 1, GuideKorisnikID: owner.ID,
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}

	checks := []struct {
		name  string
		model any
	}{
		{"akcija", &models.Akcija{}},
		{"prijava", &models.Prijava{}},
		{"prijava_izbori", &models.PrijavaIzbori{}},
		{"signup", &models.ActionSignupRequest{}},
		{"invite", &models.ActionInviteLink{}},
		{"participation", &models.ActionParticipationRequest{}},
		{"smestaj", &models.AkcijaSmestaj{}},
		{"prevoz", &models.AkcijaPrevoz{}},
		{"oprema", &models.AkcijaOprema{}},
		{"rent", &models.AkcijaOpremaRent{}},
		{"rating", &models.GuideActionRating{}},
	}
	for _, c := range checks {
		var n int64
		q := db.Model(c.model)
		switch c.model.(type) {
		case *models.PrijavaIzbori:
			q = q.Where("prijava_id = ?", prijava.ID)
		case *models.Akcija:
			q = q.Where("id = ?", akcija.ID)
		default:
			q = q.Where("akcija_id = ?", akcija.ID)
		}
		if err := q.Count(&n).Error; err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Fatalf("%s orphan rows remain: %d", c.name, n)
		}
	}
}

func TestDeleteAkcija_SignupWithoutPrijava(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner3", Password: "x", Role: "vodic"}
	reqUser := models.Korisnik{Username: "req3", Password: "x", Role: "clan"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&reqUser).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "PendingOnly", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: reqUser.ID, Status: models.ActionSignupRequestPending,
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if countWhere(t, db, &models.ActionSignupRequest{}, "akcija_id = ?", akcija.ID) != 0 {
		t.Fatal("signup request orphan")
	}
}

func TestDeleteAkcija_InviteLinksRemoved(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner4", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Invite", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionInviteLink{AkcijaID: akcija.ID, TokenHash: "inv-hash-2"}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if countWhere(t, db, &models.ActionInviteLink{}, "akcija_id = ?", akcija.ID) != 0 {
		t.Fatal("invite link orphan")
	}
}

func TestDeleteAkcija_MidFlowFailureRollsBack(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner5", Password: "x", Role: "vodic"}
	member := models.Korisnik{Username: "mem5", Password: "x", Role: "clan"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Rollback", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	prijava := models.Prijava{AkcijaID: akcija.ID, KorisnikID: member.ID, Status: "prijavljen"}
	if err := db.Create(&prijava).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: prijava.ID, SelectedSmestajIDs: "[]", SelectedPrevozIDs: "[]", SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionSignupRequest{
		AkcijaID: akcija.ID, RequesterID: member.ID, Status: models.ActionSignupRequestPending,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionInviteLink{AkcijaID: akcija.ID, TokenHash: "rb-hash"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "H"}).Error; err != nil {
		t.Fatal(err)
	}

	cbName := "force_fail_" + strings.ReplaceAll(t.Name(), "/", "_")
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(db *gorm.DB) {
		if db.Statement != nil && db.Statement.Table == "prijave" {
			_ = db.AddError(errors.New("forced mid-delete failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer db.Callback().Delete().Remove(cbName)

	err := db.Transaction(func(tx *gorm.DB) error {
		return deleteAkcijaDataTx(tx, akcija.ID)
	})
	if err == nil {
		t.Fatal("expected mid-flow failure")
	}

	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("akcija should remain after rollback")
	}
	if countWhere(t, db, &models.Prijava{}, "akcija_id = ?", akcija.ID) != 1 {
		t.Fatal("prijava should remain after rollback")
	}
	if countWhere(t, db, &models.PrijavaIzbori{}, "prijava_id = ?", prijava.ID) != 1 {
		t.Fatal("prijava_izbori should remain after rollback")
	}
	if countWhere(t, db, &models.ActionSignupRequest{}, "akcija_id = ?", akcija.ID) != 1 {
		t.Fatal("signup should remain after rollback")
	}
	if countWhere(t, db, &models.ActionInviteLink{}, "akcija_id = ?", akcija.ID) != 1 {
		t.Fatal("invite should remain after rollback")
	}
	if countWhere(t, db, &models.AkcijaSmestaj{}, "akcija_id = ?", akcija.ID) != 1 {
		t.Fatal("smestaj should remain after rollback")
	}
}

func TestDeleteAkcija_Unauthorized(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner6", Password: "x", Role: "vodic"}
	stranger := models.Korisnik{Username: "stranger6", Password: "x", Role: "clan"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Private", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionInviteLink{AkcijaID: akcija.ID, TokenHash: "unauth-hash"}).Error; err != nil {
		t.Fatal(err)
	}

	code, body := callDeleteAkcija(t, db, akcija.ID, stranger.Username, "clan")
	if code != http.StatusForbidden {
		t.Fatalf("status %d body=%v", code, body)
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", akcija.ID) != 1 {
		t.Fatal("akcija must not be deleted by unauthorized user")
	}
	if countWhere(t, db, &models.ActionInviteLink{}, "akcija_id = ?", akcija.ID) != 1 {
		t.Fatal("invite must not be deleted by unauthorized user")
	}
}

func TestDeleteAkcija_NotFound(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner7", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	code, body := callDeleteAkcija(t, db, 99999, owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%v", code, body)
	}
}

func TestDeleteAkcija_DoesNotTouchOtherAction(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner8", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	a1 := models.Akcija{Naziv: "A1", Datum: time.Now().Add(48 * time.Hour), VodicID: owner.ID, AddedByID: owner.ID}
	a2 := models.Akcija{Naziv: "A2", Datum: time.Now().Add(48 * time.Hour), VodicID: owner.ID, AddedByID: owner.ID}
	if err := db.Create(&a1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&a2).Error; err != nil {
		t.Fatal(err)
	}
	u1 := models.Korisnik{Username: "u-a1", Password: "x"}
	u2 := models.Korisnik{Username: "u-a2", Password: "x"}
	if err := db.Create(&u1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&u2).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: a1.ID, KorisnikID: u1.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Prijava{AkcijaID: a2.ID, KorisnikID: u2.ID, Status: "prijavljen"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionSignupRequest{
		AkcijaID: a2.ID, RequesterID: u2.ID, Status: models.ActionSignupRequestPending,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ActionInviteLink{AkcijaID: a2.ID, TokenHash: "other-inv"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.AkcijaSmestaj{AkcijaID: a2.ID, Naziv: "Keep"}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeleteAkcija(t, db, a1.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if countWhere(t, db, &models.Akcija{}, "id = ?", a2.ID) != 1 {
		t.Fatal("other akcija deleted")
	}
	if countWhere(t, db, &models.Prijava{}, "akcija_id = ?", a2.ID) != 1 {
		t.Fatal("other prijava deleted")
	}
	if countWhere(t, db, &models.ActionSignupRequest{}, "akcija_id = ?", a2.ID) != 1 {
		t.Fatal("other signup deleted")
	}
	if countWhere(t, db, &models.ActionInviteLink{}, "akcija_id = ?", a2.ID) != 1 {
		t.Fatal("other invite deleted")
	}
	if countWhere(t, db, &models.AkcijaSmestaj{}, "akcija_id = ?", a2.ID) != 1 {
		t.Fatal("other nested deleted")
	}
}

func TestDeleteAkcija_RepeatDeleteReturnsNotFound(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner9", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Once", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	id := akcija.ID

	code1, _ := callDeleteAkcija(t, db, id, owner.Username, "vodic")
	if code1 != http.StatusOK {
		t.Fatalf("first delete status %d", code1)
	}
	code2, body := callDeleteAkcija(t, db, id, owner.Username, "vodic")
	if code2 != http.StatusNotFound {
		t.Fatalf("repeat delete should be 404, got %d body=%v", code2, body)
	}
}

// TestDeleteAkcija_GuideBookingClearsActionID documents:
// guide-booking request/target istorija ostaje; samo action_id se nulluje.
func TestDeleteAkcija_GuideBookingClearsActionID(t *testing.T) {
	db := testDeleteAkcijaDB(t)
	owner := models.Korisnik{Username: "owner10", Password: "x", Role: "vodic"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	akcija := models.Akcija{
		Naziv: "Linked", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID,
	}
	if err := db.Create(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	booking := models.FerrataGuideBookingRequest{
		FerrataID: 1, RequesterID: owner.ID, DesiredDate: time.Now().Add(72 * time.Hour),
		TimeOfDay: "morning", NumberOfPeople: 2, GroupExperience: "mixed",
		EquipmentStatus: "complete", ContactPhone: "123",
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	aid := akcija.ID
	target := models.FerrataGuideBookingTarget{
		BookingRequestID: booking.ID, GuideProfileID: 1, GuideUserID: owner.ID,
		Status: models.GuideBookingTargetStatusAccepted, ActionID: &aid,
	}
	if err := db.Create(&target).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDeleteAkcija(t, db, akcija.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}

	var reloaded models.FerrataGuideBookingTarget
	if err := db.First(&reloaded, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.ActionID != nil {
		t.Fatalf("expected action_id cleared, got %v", *reloaded.ActionID)
	}
	if countWhere(t, db, &models.FerrataGuideBookingRequest{}, "id = ?", booking.ID) != 1 {
		t.Fatal("booking request history should remain")
	}
}
