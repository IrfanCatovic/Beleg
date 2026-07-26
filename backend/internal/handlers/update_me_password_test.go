package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func testUpdateMeDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedUpdateMeUser(t *testing.T, db *gorm.DB, username, plainPassword string) models.Korisnik {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dob := time.Date(1990, 1, 15, 0, 0, 0, 0, time.UTC)
	u := models.Korisnik{
		Username: username, Password: string(hash), Role: "clan",
		FullName: "Profile User", Email: username + "@example.com",
		Pol: "M", DatumRodjenja: &dob,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func callUpdateMe(t *testing.T, db *gorm.DB, username string, fields map[string]string) (int, map[string]any, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		if err := mw.WriteField(k, v); err != nil {
			t.Fatal(err)
		}
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPatch, "/api/me", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	c.Request = req
	c.Set("db", db)
	c.Set("username", username)
	c.Set("role", "clan")

	UpdateMe([]byte("01234567890123456789012345678901"))(c)

	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body, rec.Body.String()
}

func reloadUpdateMeUser(t *testing.T, db *gorm.DB, id uint) models.Korisnik {
	t.Helper()
	var u models.Korisnik
	if err := db.First(&u, id).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func baseProfileFields(u models.Korisnik) map[string]string {
	return map[string]string{
		"username":                        u.Username,
		"fullName":                        u.FullName,
		"email":                           u.Email,
		"pol":                             u.Pol,
		"datumRodjenja":                   "1990-01-15",
		"imeRoditelja":                    "",
		"drzavljanstvo":                   "",
		"adresa":                          "",
		"telefon":                         "",
		"brojLicnogDokumenta":             "",
		"brojPlaninarskeLegitimacije":     "",
		"brojPlaninarskeMarkice":          "",
	}
}

func TestUpdateMe_ProfileWithoutPassword_NoCurrentRequired(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_plain", "oldpass12")
	oldHash := u.Password

	fields := baseProfileFields(u)
	fields["fullName"] = "Nova Ime"
	code, body, raw := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.FullName != "Nova Ime" {
		t.Fatalf("fullName=%q", reloaded.FullName)
	}
	if reloaded.Password != oldHash {
		t.Fatal("password hash must stay unchanged")
	}
	if strings.Contains(raw, "password") || strings.Contains(raw, "currentPassword") || strings.Contains(raw, "newPassword") {
		// korisnik JSON has no password field (json:"-"), but be strict on response keys
		if k, ok := body["korisnik"].(map[string]any); ok {
			if _, has := k["password"]; has {
				t.Fatal("password must not appear in korisnik")
			}
		}
	}
}

func TestUpdateMe_OnlyCurrentPassword_NoChange(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_cur_only", "oldpass12")
	oldHash := u.Password

	fields := baseProfileFields(u)
	fields["currentPassword"] = "oldpass12"
	code, _, raw := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}
	if reloadUpdateMeUser(t, db, u.ID).Password != oldHash {
		t.Fatal("password must not change without newPassword")
	}
}

func TestUpdateMe_PasswordChange_Success(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_pw_ok", "oldpass12")

	fields := baseProfileFields(u)
	fields["fullName"] = "After PW"
	fields["currentPassword"] = "oldpass12"
	fields["newPassword"] = "newpass99"
	code, body, raw := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.FullName != "After PW" {
		t.Fatalf("fullName=%q", reloaded.FullName)
	}
	if bcrypt.CompareHashAndPassword([]byte(reloaded.Password), []byte("newpass99")) != nil {
		t.Fatal("new password must verify")
	}
	if bcrypt.CompareHashAndPassword([]byte(reloaded.Password), []byte("oldpass12")) == nil {
		t.Fatal("old password must not verify")
	}
	if k, ok := body["korisnik"].(map[string]any); ok {
		if _, has := k["password"]; has {
			t.Fatal("password leaked in response")
		}
	}
	if strings.Contains(raw, "oldpass12") || strings.Contains(raw, "newpass99") {
		t.Fatal("plaintext password leaked")
	}
}

func TestUpdateMe_NewPasswordWithoutCurrent_NoUpdate(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_pw_miss", "oldpass12")
	oldHash := u.Password

	fields := baseProfileFields(u)
	fields["fullName"] = "Should Not Save"
	fields["newPassword"] = "newpass99"
	code, body, _ := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d want 400", code)
	}
	if body["error"] != "Unesite trenutnu lozinku da biste postavili novu." {
		t.Fatalf("error=%v", body["error"])
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Password != oldHash {
		t.Fatal("hash must stay")
	}
	if reloaded.FullName != "Profile User" {
		t.Fatalf("profile fields must not change, fullName=%q", reloaded.FullName)
	}
}

func TestUpdateMe_WrongCurrentPassword_NoUpdate(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_pw_wrong", "oldpass12")
	oldHash := u.Password

	fields := baseProfileFields(u)
	fields["fullName"] = "Nope"
	fields["currentPassword"] = "wrong-pass"
	fields["newPassword"] = "newpass99"
	code, body, _ := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d want 400", code)
	}
	if body["error"] != "Trenutna lozinka nije ispravna." {
		t.Fatalf("error=%v", body["error"])
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Password != oldHash || reloaded.FullName != "Profile User" {
		t.Fatal("no fields may change on wrong current password")
	}
}

func TestUpdateMe_ShortNewPassword_NoUpdate(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_pw_short", "oldpass12")
	oldHash := u.Password

	fields := baseProfileFields(u)
	fields["currentPassword"] = "oldpass12"
	fields["newPassword"] = "short"
	fields["fullName"] = "Nope"
	code, _, _ := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d", code)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Password != oldHash || reloaded.FullName != "Profile User" {
		t.Fatal("no update on short password")
	}
}

func TestUpdateMe_EmptyNewPassword_NotHashed(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_pw_empty", "oldpass12")
	oldHash := u.Password

	fields := baseProfileFields(u)
	fields["newPassword"] = "   "
	fields["currentPassword"] = "oldpass12"
	code, _, raw := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}
	if reloadUpdateMeUser(t, db, u.ID).Password != oldHash {
		t.Fatal("whitespace-only newPassword must not change hash")
	}
}

func TestUpdateMe_MalformedPasswordHash_SafeError(t *testing.T) {
	db := testUpdateMeDB(t)
	u := seedUpdateMeUser(t, db, "me_pw_badhash", "oldpass12")
	if err := db.Model(&u).Update("password", "not-a-bcrypt-hash").Error; err != nil {
		t.Fatal(err)
	}
	oldName := u.FullName

	fields := baseProfileFields(u)
	fields["fullName"] = "Should Not Save"
	fields["currentPassword"] = "anything1"
	fields["newPassword"] = "newpass99"
	code, body, _ := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d want 400", code)
	}
	if body["error"] != "Trenutna lozinka nije ispravna." {
		t.Fatalf("error=%v", body["error"])
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Password != "not-a-bcrypt-hash" {
		t.Fatal("malformed hash must stay")
	}
	if reloaded.FullName != oldName {
		t.Fatal("profile must not change on compare failure")
	}
}

func TestUpdateMe_IgnoresBodyUserId(t *testing.T) {
	db := testUpdateMeDB(t)
	a := seedUpdateMeUser(t, db, "me_victim", "oldpass12")
	b := seedUpdateMeUser(t, db, "me_other", "otherpass")
	oldBHash := b.Password
	oldBName := b.FullName

	fields := baseProfileFields(a)
	fields["fullName"] = "Victim Updated"
	fields["id"] = fmt.Sprintf("%d", b.ID)
	fields["userId"] = fmt.Sprintf("%d", b.ID)
	fields["currentPassword"] = "oldpass12"
	fields["newPassword"] = "newpass99"
	code, _, raw := callUpdateMe(t, db, a.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}
	reloadedA := reloadUpdateMeUser(t, db, a.ID)
	if reloadedA.FullName != "Victim Updated" {
		t.Fatalf("auth user fullName=%q", reloadedA.FullName)
	}
	if bcrypt.CompareHashAndPassword([]byte(reloadedA.Password), []byte("newpass99")) != nil {
		t.Fatal("auth user password must change")
	}
	reloadedB := reloadUpdateMeUser(t, db, b.ID)
	if reloadedB.Password != oldBHash || reloadedB.FullName != oldBName {
		t.Fatal("other user must remain unchanged")
	}
}
