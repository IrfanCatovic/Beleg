package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testGetKorisniciDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Klubovi{},
		&models.Korisnik{},
		&models.Block{},
		&models.GuideProfile{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func callGetKorisnici(t *testing.T, db *gorm.DB, username, scope string, role string, klubID *uint) (int, map[string]any, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	path := "/korisnici"
	if scope != "" {
		path += "?scope=" + scope
	}
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	c.Set("db", db)
	c.Set("username", username)
	if role != "" {
		c.Set("role", role)
	}
	if klubID != nil {
		c.Set("klubId", *klubID)
	}
	GetKorisnici(c)

	raw := w.Body.String()
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, raw)
	}
	return w.Code, body, raw
}

func seedClubWithMembers(t *testing.T, db *gorm.DB) (clubA, clubB models.Klubovi, viewer, peerA, peerB models.Korisnik) {
	t.Helper()
	clubA = models.Klubovi{Naziv: "Klub A", LogoURL: "https://cdn.example/a.png"}
	clubB = models.Klubovi{Naziv: "Klub B", LogoURL: "https://cdn.example/b.png"}
	if err := db.Create(&clubA).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&clubB).Error; err != nil {
		t.Fatal(err)
	}

	viewer = models.Korisnik{
		Username: "viewer_club", Password: "x", Role: "clan", FullName: "Viewer",
		KlubID: &clubA.ID, Email: "viewer@example.com", Telefon: "+111",
	}
	peerA = models.Korisnik{
		Username: "peer_a", Password: "x", Role: "vodic", FullName: "Peer A",
		KlubID: &clubA.ID,
		Email:  "private-a@example.com", Telefon: "+38160000000",
		Adresa: "Private Street 1", Drzavljanstvo: "RS", Pol: "m",
		BrojLicnogDokumenta: "ID-SECRET", BrojPlaninarskeLegitimacije: "LEG-SECRET",
		BrojPlaninarskeMarkice: "MARK-SECRET",
		IzreceneDisciplinskeKazne: "Kazna secret", Napomene: "Internal note",
		UkupnoKmKorisnik: 12.5, UkupnoMetaraUsponaKorisnik: 400, BrojPopeoSe: 3,
		AvatarURL: "https://cdn.example/peer-a.jpg",
	}
	dob := time.Date(1990, 5, 1, 0, 0, 0, 0, time.UTC)
	peerA.DatumRodjenja = &dob
	peerB = models.Korisnik{
		Username: "peer_b", Password: "x", Role: "clan", FullName: "Peer B",
		KlubID: &clubB.ID, Email: "private-b@example.com", Telefon: "+222",
	}
	if err := db.Create(&viewer).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&peerA).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&peerB).Error; err != nil {
		t.Fatal(err)
	}
	return clubA, clubB, viewer, peerA, peerB
}

func korisniciList(t *testing.T, body map[string]any) []map[string]any {
	t.Helper()
	raw, ok := body["korisnici"].([]any)
	if !ok {
		t.Fatalf("korisnici missing or wrong type: %#v", body["korisnici"])
	}
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("item not object: %#v", item)
		}
		out = append(out, m)
	}
	return out
}

func assertNoPrivateKeys(t *testing.T, rawJSON string, items []map[string]any) {
	t.Helper()
	forbiddenSubstrings := []string{
		`"email"`, `"telefon"`, `"adresa"`, `"datum_rodjenja"`, `"drzavljanstvo"`,
		`"pol"`, `"broj_licnog_dokumenta"`, `"broj_planinarske_legitimacije"`,
		`"broj_planinarske_markice"`, `"password"`, `"izrecene_disciplinske_kazne"`,
		`"napomene"`, `"email_verified_at"`, `"ime_roditelja"`,
	}
	lower := strings.ToLower(rawJSON)
	for _, s := range forbiddenSubstrings {
		if strings.Contains(lower, strings.ToLower(s)) {
			t.Fatalf("private key substring %s found in response JSON", s)
		}
	}
	for _, item := range items {
		for _, k := range []string{
			"email", "telefon", "adresa", "datum_rodjenja", "drzavljanstvo", "pol",
			"broj_licnog_dokumenta", "broj_planinarske_legitimacije", "broj_planinarske_markice",
			"password", "izrecene_disciplinske_kazne", "napomene", "email_verified_at",
			"ime_roditelja", "is_active", "isActive",
		} {
			if _, exists := item[k]; exists {
				t.Fatalf("private field %q present in item: %#v", k, item)
			}
		}
	}
}

func TestGetKorisnici_GlobalScope_PublicDTOOnly(t *testing.T) {
	db := testGetKorisniciDB(t)
	_, _, viewer, peerA, _ := seedClubWithMembers(t, db)

	code, body, raw := callGetKorisnici(t, db, viewer.Username, "global", "clan", &[]uint{*viewer.KlubID}[0])
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	list := korisniciList(t, body)
	assertNoPrivateKeys(t, raw, list)

	var found bool
	for _, item := range list {
		if int(item["id"].(float64)) == int(peerA.ID) {
			found = true
			if item["username"] != "peer_a" || item["fullName"] != "Peer A" {
				t.Fatalf("public fields: %#v", item)
			}
			if item["avatar_url"] != peerA.AvatarURL {
				t.Fatalf("avatar=%v", item["avatar_url"])
			}
			if item["role"] != "vodic" {
				t.Fatalf("role=%v", item["role"])
			}
		}
		if int(item["id"].(float64)) == int(viewer.ID) {
			t.Fatal("global scope must exclude self")
		}
	}
	if !found {
		t.Fatal("peer_a missing from global list")
	}
}

func TestGetKorisnici_ClubScope_PublicDTONoPrivateFields(t *testing.T) {
	db := testGetKorisniciDB(t)
	clubA, _, viewer, peerA, peerB := seedClubWithMembers(t, db)

	code, body, raw := callGetKorisnici(t, db, viewer.Username, "club", "clan", &clubA.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	list := korisniciList(t, body)
	assertNoPrivateKeys(t, raw, list)

	ids := map[uint]bool{}
	for _, item := range list {
		id := uint(item["id"].(float64))
		ids[id] = true
		if id == peerA.ID {
			if item["klubNaziv"] != "Klub A" {
				t.Fatalf("klubNaziv=%v", item["klubNaziv"])
			}
			if item["ukupnoKm"] != 12.5 {
				t.Fatalf("ukupnoKm=%v", item["ukupnoKm"])
			}
			if int(item["brojPopeoSe"].(float64)) != 3 {
				t.Fatalf("brojPopeoSe=%v", item["brojPopeoSe"])
			}
		}
	}
	if !ids[viewer.ID] || !ids[peerA.ID] {
		t.Fatalf("club roster missing members: %v", ids)
	}
	if ids[peerB.ID] {
		t.Fatal("club A must not include club B member")
	}
	if strings.Contains(raw, "private-a@example.com") || strings.Contains(raw, "LEG-SECRET") {
		t.Fatal("private values leaked in JSON body")
	}
}

func TestGetKorisnici_ClubIsolation(t *testing.T) {
	db := testGetKorisniciDB(t)
	_, clubB, _, _, peerB := seedClubWithMembers(t, db)

	code, body, _ := callGetKorisnici(t, db, peerB.Username, "", "clan", &clubB.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	list := korisniciList(t, body)
	for _, item := range list {
		if item["klubNaziv"] == "Klub A" {
			t.Fatal("club B viewer must not see club A")
		}
	}
}

func TestGetKorisnici_NoClub_EmptySafeList(t *testing.T) {
	db := testGetKorisniciDB(t)
	u := models.Korisnik{Username: "noclub", Password: "x", Role: "clan", Email: "x@y.com"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	code, body, _ := callGetKorisnici(t, db, u.Username, "", "clan", nil)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}
	list := korisniciList(t, body)
	if len(list) != 0 {
		t.Fatalf("expected empty list, got %#v", list)
	}
}

func TestGetKorisnici_DeletedExcluded(t *testing.T) {
	db := testGetKorisniciDB(t)
	clubA, _, viewer, peerA, _ := seedClubWithMembers(t, db)
	if err := db.Model(&peerA).Update("role", "deleted").Error; err != nil {
		t.Fatal(err)
	}
	code, body, _ := callGetKorisnici(t, db, viewer.Username, "club", "clan", &clubA.ID)
	if code != http.StatusOK {
		t.Fatalf("status=%d", code)
	}
	for _, item := range korisniciList(t, body) {
		if uint(item["id"].(float64)) == peerA.ID {
			t.Fatal("deleted user must be excluded")
		}
	}
}

func TestGetKorisnici_AdminInfoStillFullForAdmin(t *testing.T) {
	db := testGetKorisniciDB(t)
	clubA, _, _, peerA, _ := seedClubWithMembers(t, db)
	admin := models.Korisnik{
		Username: "club_admin", Password: "x", Role: "admin", KlubID: &clubA.ID,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/korisnici/"+peerA.Username+"/info", nil)
	c.Params = gin.Params{{Key: "id", Value: peerA.Username}}
	c.Set("db", db)
	c.Set("username", admin.Username)
	c.Set("role", "admin")
	c.Set("klubId", clubA.ID)
	GetKorisnikInfo(c)
	if w.Code != http.StatusOK {
		t.Fatalf("admin info status=%d body=%s", w.Code, w.Body.String())
	}
	var info map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &info); err != nil {
		t.Fatal(err)
	}
	if info["email"] != "private-a@example.com" {
		t.Fatalf("admin info must keep email, got %#v", info["email"])
	}

	// Ordinary member cannot use admin info.
	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodGet, "/korisnici/"+peerA.Username+"/info", nil)
	c2.Params = gin.Params{{Key: "id", Value: peerA.Username}}
	c2.Set("db", db)
	c2.Set("username", "viewer_club")
	c2.Set("role", "clan")
	c2.Set("klubId", clubA.ID)
	GetKorisnikInfo(c2)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("clan info status=%d want 403", w2.Code)
	}
}

func TestBuildPublicUserDTO_DoesNotCopyPrivateFields(t *testing.T) {
	k := models.Korisnik{
		ID: 9, Username: "u", FullName: "N", AvatarURL: "a", Role: "clan",
		Email: "e@x.com", Telefon: "t", Adresa: "addr", Password: "hash",
		BrojLicnogDokumenta: "doc", Napomene: "n",
		UkupnoKmKorisnik: 1, BrojPopeoSe: 2,
	}
	dto := BuildPublicUserDTO(k, true)
	b, err := json.Marshal(dto)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, bad := range []string{"email", "telefon", "adresa", "password", "napomene", "broj_licnog"} {
		if strings.Contains(s, bad) {
			t.Fatalf("DTO JSON contains %q: %s", bad, s)
		}
	}
	if dto.ID != 9 || dto.Username != "u" || !dto.IsProfiGuide || dto.BrojPopeoSe != 2 {
		t.Fatalf("dto=%#v", dto)
	}
}
