package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/services/actions"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testPrevozDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
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
		&models.AkcijaSmestaj{},
		&models.AkcijaPrevoz{},
		&models.AkcijaOpremaRent{},
		&models.Transakcija{},
		&models.Obavestenje{},
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

func seedPrevozHost(t *testing.T, db *gorm.DB, username string) models.Korisnik {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "vodic"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedPrevozAkcija(t *testing.T, db *gorm.DB, owner models.Korisnik, opts ...func(*models.Akcija)) models.Akcija {
	t.Helper()
	a := models.Akcija{
		Naziv: "Prevoz", Datum: time.Now().Add(48 * time.Hour),
		VodicID: owner.ID, AddedByID: owner.ID, OrganizatorTip: "vodic",
		CenaClan: 100, CenaOstali: 100,
	}
	for _, o := range opts {
		o(&a)
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func seedPrevozMember(t *testing.T, db *gorm.DB, akcijaID uint, username string, platio bool, prevozJSON string) (models.Korisnik, models.Prijava) {
	t.Helper()
	u := models.Korisnik{Username: username, Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcijaID, KorisnikID: u.ID, Status: "prijavljen", Platio: platio}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: "[]", SelectedPrevozIDs: prevozJSON, SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}
	return u, p
}

func callDodajPrevoz(t *testing.T, db *gorm.DB, akcijaID uint, username, role string, body any) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var buf bytes.Buffer
	_ = json.NewEncoder(&buf).Encode(body)
	c.Request = httptest.NewRequest(http.MethodPost, "/akcije/"+strconv.FormatUint(uint64(akcijaID), 10)+"/prevoz", &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)}}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	DodajPrevozZaAkciju(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func callObrisiPrevoz(t *testing.T, db *gorm.DB, akcijaID, prevozID uint, username, role string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	path := "/akcije/" + strconv.FormatUint(uint64(akcijaID), 10) + "/prevoz/" + strconv.FormatUint(uint64(prevozID), 10)
	c.Request = httptest.NewRequest(http.MethodDelete, path, nil)
	c.Params = gin.Params{
		{Key: "id", Value: strconv.FormatUint(uint64(akcijaID), 10)},
		{Key: "prevozId", Value: strconv.FormatUint(uint64(prevozID), 10)},
	}
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", role)
	ObrisiPrevozZaAkciju(c)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func createPrevozRow(t *testing.T, db *gorm.DB, akcijaID uint, naziv string, cena float64) models.AkcijaPrevoz {
	t.Helper()
	row := models.AkcijaPrevoz{
		AkcijaID: akcijaID, TipPrevoza: "auto", NazivGrupe: naziv, Kapacitet: 5, CenaPoOsobi: cena,
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatal(err)
	}
	return row
}

func countPrevoz(t *testing.T, db *gorm.DB, prevozID uint) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.AkcijaPrevoz{}).Where("id = ?", prevozID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func pauseBeforePrevozAkcijaLock(t *testing.T, db *gorm.DB, reached chan<- struct{}, cont <-chan struct{}) func() {
	t.Helper()
	var paused int32
	cbName := "pv_before_akcija_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "akcije" || !statementHasForUpdate(tx.Statement) {
			return
		}
		if !atomic.CompareAndSwapInt32(&paused, 0, 1) {
			return
		}
		close(reached)
		<-cont
	}); err != nil {
		t.Fatal(err)
	}
	return func() { _ = db.Callback().Query().Remove(cbName) }
}

func TestDodajPrevoz_ActiveInsert_Success(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_add_h")
	akcija := seedPrevozAkcija(t, db, owner)

	code, body := callDodajPrevoz(t, db, akcija.ID, owner.Username, "vodic", map[string]any{
		"nazivGrupe": "Kombi", "tipPrevoza": "auto", "kapacitet": 8, "cenaPoOsobi": 50,
	})
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	prevoz, ok := body["prevoz"].(map[string]any)
	if !ok || prevoz["nazivGrupe"] != "Kombi" {
		t.Fatalf("prevoz=%v", body["prevoz"])
	}
}

func TestDodajPrevoz_NewOption_NoPlatioReset(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_add_nr_h")
	akcija := seedPrevozAkcija(t, db, owner)
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_add_nr_m", true, "[]")

	code, _ := callDodajPrevoz(t, db, akcija.ID, owner.Username, "vodic", map[string]any{
		"nazivGrupe": "Novi", "kapacitet": 4, "cenaPoOsobi": 80,
	})
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("unrelated Platio must stay true")
	}
}

func TestDodajPrevoz_Completed_Blocked(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_add_done_h")
	akcija := seedPrevozAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })

	code, body := callDodajPrevoz(t, db, akcija.ID, owner.Username, "vodic", map[string]any{
		"nazivGrupe": "X", "kapacitet": 4, "cenaPoOsobi": 10,
	})
	if code != http.StatusBadRequest {
		t.Fatalf("status %d body=%v", code, body)
	}
}

func TestDodajPrevoz_Cancelled_Blocked(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_add_canc_h")
	now := time.Now()
	akcija := seedPrevozAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Otkaz"
	})

	code, body := callDodajPrevoz(t, db, akcija.ID, owner.Username, "vodic", map[string]any{
		"nazivGrupe": "X", "kapacitet": 4, "cenaPoOsobi": 10,
	})
	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
}

func TestDodajPrevoz_Unauthorized_Forbidden(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_add_un_h")
	akcija := seedPrevozAkcija(t, db, owner)
	stranger := models.Korisnik{Username: "pv_add_un_s", Password: "x", Role: "clan"}
	if err := db.Create(&stranger).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callDodajPrevoz(t, db, akcija.ID, stranger.Username, "clan", map[string]any{
		"nazivGrupe": "X", "kapacitet": 4, "cenaPoOsobi": 10,
	})
	if code != http.StatusForbidden {
		t.Fatalf("status %d", code)
	}
	var n int64
	db.Model(&models.AkcijaPrevoz{}).Where("akcija_id = ?", akcija.ID).Count(&n)
	if n != 0 {
		t.Fatal("no insert for unauthorized")
	}
}

func TestObrisiPrevoz_Unused_NoPlatioUpdate(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_u_h")
	akcija := seedPrevozAkcija(t, db, owner)
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_del_u_m", true, "[]")
	row := createPrevozRow(t, db, akcija.ID, "Unused", 40)

	var updates int32
	cbName := "pv_unused_platio_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijave" {
			atomic.AddInt32(&updates, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if countPrevoz(t, db, row.ID) != 0 {
		t.Fatal("prevoz must be deleted")
	}
	if atomic.LoadInt32(&updates) != 0 {
		t.Fatalf("expected no prijave UPDATE, got %d", updates)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must stay true")
	}
}

func TestObrisiPrevoz_NotFound(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_nf_h")
	akcija := seedPrevozAkcija(t, db, owner)
	code, body := callObrisiPrevoz(t, db, akcija.ID, 99999, owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d body=%v", code, body)
	}
	if code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestObrisiPrevoz_RelationMismatch_NoDelete(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_mis_h")
	akcija := seedPrevozAkcija(t, db, owner)
	other := seedPrevozAkcija(t, db, owner, func(a *models.Akcija) { a.Naziv = "Other" })
	row := createPrevozRow(t, db, other.ID, "Foreign", 20)

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusNotFound {
		t.Fatalf("status %d want 404", code)
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("foreign prevoz must remain")
	}
}

func TestObrisiPrevoz_PricedSelected_ResetsPlatio(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_paid_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "PaidBus", 50)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_del_paid_m", true, prevozJSON)
	_, untouched := seedPrevozMember(t, db, akcija.ID, "pv_del_paid_u", true, "[]")

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if countPrevoz(t, db, row.ID) != 0 {
		t.Fatal("prevoz deleted")
	}
	izbor := getIzbori(t, db, p.ID)
	if izbor.SelectedPrevozIDs != "[]" && izbor.SelectedPrevozIDs != "null" {
		var sel []uint
		_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &sel)
		if helpers.ChoiceIDsContain(sel, row.ID) {
			t.Fatal("selection must not keep deleted prevoz")
		}
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("affected paid must become false")
	}
	if !getPrijavaPlatio(t, db, untouched.ID) {
		t.Fatal("unaffected paid must stay true")
	}
}

func TestObrisiPrevoz_AffectedAlreadyUnpaid_StaysFalse(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_unp_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 40)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_del_unp_m", false, prevozJSON)

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("must stay false")
	}
}

func TestObrisiPrevoz_MultipleAffected_AllReset(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_multi_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Shared", 30)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p1 := seedPrevozMember(t, db, akcija.ID, "pv_del_m1", true, prevozJSON)
	_, p2 := seedPrevozMember(t, db, akcija.ID, "pv_del_m2", true, prevozJSON)

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if getPrijavaPlatio(t, db, p1.ID) || getPrijavaPlatio(t, db, p2.ID) {
		t.Fatal("both affected must reset")
	}
}

func TestObrisiPrevoz_ZeroPrice_NoPlatioReset(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_z_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Free", 0)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_del_z_m", true, prevozJSON)

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("zero-price removal must keep Platio when saldo unchanged")
	}
}

func TestObrisiPrevoz_WithOtherChoices_UsesFullSaldo(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_full_h")
	akcija := seedPrevozAkcija(t, db, owner)
	smestaj := models.AkcijaSmestaj{AkcijaID: akcija.ID, Naziv: "Hotel", CenaPoOsobiUkupno: 70}
	if err := db.Create(&smestaj).Error; err != nil {
		t.Fatal(err)
	}
	row := createPrevozRow(t, db, akcija.ID, "Bus", 25)
	u := models.Korisnik{Username: "pv_del_full_m", Password: "x", Role: "clan"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	p := models.Prijava{AkcijaID: akcija.ID, KorisnikID: u.ID, Status: "prijavljen", Platio: true}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	smJSON, _ := json.Marshal([]uint{smestaj.ID})
	prJSON, _ := json.Marshal([]uint{row.ID})
	if err := db.Create(&models.PrijavaIzbori{
		PrijavaID: p.ID, SelectedSmestajIDs: string(smJSON), SelectedPrevozIDs: string(prJSON), SelectedRentItemsRaw: "[]",
	}).Error; err != nil {
		t.Fatal(err)
	}

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("removing priced prevoz must reset even with other choices")
	}
	izbor := getIzbori(t, db, p.ID)
	var sm []uint
	_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &sm)
	if len(sm) != 1 || sm[0] != smestaj.ID {
		t.Fatal("smestaj selection must remain")
	}
}

func TestObrisiPrevoz_Completed_Blocked(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_done_h")
	akcija := seedPrevozAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })
	row := createPrevozRow(t, db, akcija.ID, "X", 10)

	code, body := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusBadRequest {
		t.Fatalf("status %d body=%v", code, body)
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("must remain")
	}
}

func TestObrisiPrevoz_Cancelled_Blocked(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_canc_h")
	now := time.Now()
	akcija := seedPrevozAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Otkaz"
	})
	row := createPrevozRow(t, db, akcija.ID, "X", 10)

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
}

func TestObrisiPrevoz_Contradictory_PrefersCancelled(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_del_both_h")
	now := time.Now()
	akcija := seedPrevozAkcija(t, db, owner, func(a *models.Akcija) {
		a.IsCompleted = true
		a.IsCancelled = true
		a.CancelledAt = &now
		a.CancellationReason = "Both"
	})
	row := createPrevozRow(t, db, akcija.ID, "X", 10)

	code, body := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusConflict {
		t.Fatalf("status %d", code)
	}
	if body["error"] != helpers.ErrAkcijaCancelled.Error() {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestObrisiPrevoz_StaleActive_LockedCompletedBlocks(t *testing.T) {
	db := testPrevozDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedPrevozHost(t, db, "pv_stale_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "X", 10)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforePrevozAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	}()

	<-reached
	if err := db.Model(&models.Akcija{}).Where("id = ?", akcija.ID).Update("is_completed", true).Error; err != nil {
		t.Fatal(err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusBadRequest {
		t.Fatalf("status %d", code)
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("must remain")
	}
}

func TestObrisiPrevoz_MarkPaidFirst_ThenDeleteResets(t *testing.T) {
	db := testPrevozDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedPrevozHost(t, db, "pv_mp_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 45)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_mp_m", false, prevozJSON)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforePrevozAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	}()

	<-reached
	paidCode, _ := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if paidCode != http.StatusOK {
		t.Fatalf("mark-paid %d", paidCode)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusOK {
		t.Fatalf("delete status %d", code)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("after mark-paid then delete with delta, Platio must be false")
	}
}

func TestObrisiPrevoz_DeleteFirst_MarkPaidOK(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_dm_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 20)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_dm_m", false, prevozJSON)

	if code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic"); code != http.StatusOK {
		t.Fatal("delete failed")
	}
	code, _ := callUpdatePrijavaPlatio(t, db, p.ID, true, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("mark-paid after delete status %d", code)
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("mark-paid must succeed on new state")
	}
}

func TestObrisiPrevoz_DeleteFirst_ChoicesRejectsDeletedID(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_ch_h")
	user := seedUser(t, db, "pv_ch_u")
	akcija := seedOpenAkcija(t, db, 10)
	akcija.VodicID = owner.ID
	akcija.AddedByID = owner.ID
	akcija.OrganizatorTip = "vodic"
	if err := db.Save(&akcija).Error; err != nil {
		t.Fatal(err)
	}
	row := createPrevozRow(t, db, akcija.ID, "Gone", 15)
	_ = seedPrijavaSPlatio(t, db, akcija.ID, user.ID, false, "[]")

	if code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic"); code != http.StatusOK {
		t.Fatal("delete failed")
	}
	code, body := callUpdateMojaPrijavaIzbori(t, db, akcija.ID, user.Username, prijavaChoicesPayload{
		SelectedPrevozIDs: []uint{row.ID},
	})
	if code == http.StatusOK {
		t.Fatal("choices must reject deleted prevoz id")
	}
	if code >= 500 {
		t.Fatalf("must not 500: %d body=%v", code, body)
	}
}

func TestObrisiPrevoz_FinishFirst_Blocked(t *testing.T) {
	db := testPrevozDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedPrevozHost(t, db, "pv_ff_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "X", 10)
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_ff_m", false, "[]")

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforePrevozAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, _ = callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	}()

	<-reached
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}
	fresh := akcija
	if _, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusBadRequest {
		t.Fatalf("status %d", code)
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("must remain")
	}
}

func TestObrisiPrevoz_DeleteFirst_FinishUsesNewState(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_df_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 40)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_df_m", true, prevozJSON)

	if code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic"); code != http.StatusOK {
		t.Fatal("delete failed")
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("expected Platio=false before finish")
	}
	if err := db.Model(&models.Prijava{}).Where("id = ?", p.ID).Update("status", "popeo se").Error; err != nil {
		t.Fatal(err)
	}
	fresh := akcija
	res, err := actions.FinishAction(db, &fresh, owner, actions.FinishActionInput{})
	if err != nil {
		t.Fatalf("finish: %v", err)
	}
	if !res.Akcija.IsCompleted {
		t.Fatal("expected completed")
	}
}

func TestObrisiPrevoz_CancelFirst_Blocked(t *testing.T) {
	db := testPrevozDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(2)

	owner := seedPrevozHost(t, db, "pv_cf_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "X", 10)

	reached := make(chan struct{})
	cont := make(chan struct{})
	cleanup := pauseBeforePrevozAkcijaLock(t, db, reached, cont)
	defer cleanup()

	var code int
	var body map[string]any
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		code, body = callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	}()

	<-reached
	cancelCode, _ := callOtkaziAkciju(t, db, akcija.ID, owner.Username, "vodic", map[string]string{
		"reason": "Otkaz prije prevoz delete",
	})
	if cancelCode != http.StatusOK {
		t.Fatalf("cancel %d", cancelCode)
	}
	close(cont)
	wg.Wait()

	if code != http.StatusConflict {
		t.Fatalf("status %d body=%v", code, body)
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("must remain")
	}
}

func TestObrisiPrevoz_LockOrderAkcijaPrijavaIzbori(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_ord_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 30)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, _ = seedPrevozMember(t, db, akcija.ID, "pv_ord_m", true, prevozJSON)

	var order []string
	var mu sync.Mutex
	cbName := "pv_lock_order_" + t.Name()
	if err := db.Callback().Query().Before("gorm:query").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil || !statementHasForUpdate(tx.Statement) {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		switch tx.Statement.Table {
		case "akcije":
			order = append(order, "akcija")
		case "akcija_prevoz":
			order = append(order, "prevoz")
		case "prijave":
			order = append(order, "prijava")
		case "prijava_izbori":
			order = append(order, "izbori")
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove(cbName) })

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(order) < 3 || order[0] != "akcija" {
		t.Fatalf("lock order=%v want akcija first", order)
	}
	prijavaIdx, izboriIdx := -1, -1
	for i, s := range order {
		if s == "prijava" && prijavaIdx < 0 {
			prijavaIdx = i
		}
		if s == "izbori" && izboriIdx < 0 {
			izboriIdx = i
		}
	}
	if prijavaIdx < 0 || izboriIdx < 0 || izboriIdx < prijavaIdx {
		t.Fatalf("want Prijava before PrijavaIzbori in %v", order)
	}
	for i := 1; i < len(order); i++ {
		if order[i] == "akcija" && (order[i-1] == "prijava" || order[i-1] == "izbori" || order[i-1] == "prevoz") {
			t.Fatalf("found inversion toward Akcija in %v", order)
		}
	}
}

func TestObrisiPrevoz_ChoiceDeleteError_Rollback(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_rb_ch_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 30)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_rb_ch_m", true, prevozJSON)

	cbName := "pv_izbori_fail_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "prijava_izbori" {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("prevoz must remain")
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must remain true")
	}
}

func TestObrisiPrevoz_PrevozDeleteError_Rollback(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_rb_pv_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 30)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_rb_pv_m", true, prevozJSON)

	cbName := "pv_prevoz_fail_" + t.Name()
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "akcija_prevoz" {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Delete().Remove(cbName) })

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("prevoz must remain")
	}
	izbor := getIzbori(t, db, p.ID)
	var sel []uint
	_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &sel)
	if !helpers.ChoiceIDsContain(sel, row.ID) {
		t.Fatal("izbori must rollback")
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must remain true")
	}
}

func TestObrisiPrevoz_PlatioResetError_Rollback(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_rb_pl_h")
	akcija := seedPrevozAkcija(t, db, owner)
	row := createPrevozRow(t, db, akcija.ID, "Bus", 30)
	prevozJSON := "[" + strconv.FormatUint(uint64(row.ID), 10) + "]"
	_, p := seedPrevozMember(t, db, akcija.ID, "pv_rb_pl_m", true, prevozJSON)

	var sawIzboriSave int32
	cbName := "pv_platio_fail_" + t.Name()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement == nil {
			return
		}
		if tx.Statement.Table == "prijava_izbori" {
			atomic.StoreInt32(&sawIzboriSave, 1)
			return
		}
		if tx.Statement.Table == "prijave" && atomic.LoadInt32(&sawIzboriSave) == 1 {
			_ = tx.AddError(gorm.ErrInvalidTransaction)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Update().Remove(cbName) })

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countPrevoz(t, db, row.ID) != 1 {
		t.Fatal("prevoz must rollback")
	}
	izbor := getIzbori(t, db, p.ID)
	var sel []uint
	_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &sel)
	if !helpers.ChoiceIDsContain(sel, row.ID) {
		t.Fatal("izbori must rollback")
	}
	if !getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("Platio must remain true")
	}
}

func TestObrisiPrevoz_GuardError_NoMutation(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_gd_h")
	akcija := seedPrevozAkcija(t, db, owner, func(a *models.Akcija) { a.IsCompleted = true })
	row := createPrevozRow(t, db, akcija.ID, "X", 10)

	var deletes int32
	cbName := "pv_guard_no_del_" + t.Name()
	if err := db.Callback().Delete().Before("gorm:delete").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "akcija_prevoz" {
			atomic.AddInt32(&deletes, 1)
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Delete().Remove(cbName) })

	code, _ := callObrisiPrevoz(t, db, akcija.ID, row.ID, owner.Username, "vodic")
	if code != http.StatusBadRequest {
		t.Fatalf("status %d", code)
	}
	if atomic.LoadInt32(&deletes) != 0 {
		t.Fatalf("expected no delete, got %d", deletes)
	}
}

func TestDodajPrevoz_JoinResetsPlatioWhenSaldoChanges(t *testing.T) {
	db := testPrevozDB(t)
	owner := seedPrevozHost(t, db, "pv_join_h")
	akcija := seedPrevozAkcija(t, db, owner)
	user, p := seedPrevozMember(t, db, akcija.ID, "pv_join_m", true, "[]")

	code, body := callDodajPrevoz(t, db, akcija.ID, user.Username, "clan", map[string]any{
		"nazivGrupe": "Moj", "kapacitet": 4, "cenaPoOsobi": 55, "join": true,
	})
	if code != http.StatusOK {
		t.Fatalf("status %d body=%v", code, body)
	}
	if getPrijavaPlatio(t, db, p.ID) {
		t.Fatal("join into priced prevoz must reset Platio")
	}
}
