package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func testRegisterOpenDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "register_open")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}, &models.PendingOpenRegistration{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func callRegisterOpen(t *testing.T, db *gorm.DB, body string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPost, "/api/register/open", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("db", db)
	RegisterOpen(db)(c)
	var parsed map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &parsed)
	return rec.Code, parsed
}

func validOpenRegisterPayload(username string) string {
	return `{
		"username":"` + username + `",
		"password":"password12",
		"email":"` + username + `@example.com",
		"fullName":"Test User",
		"pol":"M",
		"datumRodjenja":"1990-01-15"
	}`
}

func TestRegisterOpen_DuplicateUsernameConflict(t *testing.T) {
	db := testRegisterOpenDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("password12"), bcrypt.MinCost)
	if err := db.Create(&models.Korisnik{Username: "taken", Password: string(hash), Role: ""}).Error; err != nil {
		t.Fatal(err)
	}

	status, body := callRegisterOpen(t, db, validOpenRegisterPayload("taken"))
	if status != http.StatusConflict {
		t.Fatalf("status %d body=%v", status, body)
	}
}

func TestRegisterOpen_DuplicateEmailConflict(t *testing.T) {
	db := testRegisterOpenDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("password12"), bcrypt.MinCost)
	if err := db.Create(&models.Korisnik{
		Username: "other", Password: string(hash), Role: "", Email: "dup@example.com",
	}).Error; err != nil {
		t.Fatal(err)
	}

	payload := `{
		"username":"newuser",
		"password":"password12",
		"email":"dup@example.com",
		"fullName":"Test",
		"pol":"M",
		"datumRodjenja":"1990-01-15"
	}`
	status, _ := callRegisterOpen(t, db, payload)
	if status != http.StatusConflict {
		t.Fatalf("status %d", status)
	}
}

func TestRegisterOpen_UsernameCaseNormalizedToLower(t *testing.T) {
	db := testRegisterOpenDB(t)
	// Validation path only — email send will fail in test env; we assert pre-email validation passes
	// by checking weak password instead for case test on duplicate:
	hash, _ := bcrypt.GenerateFromPassword([]byte("password12"), bcrypt.MinCost)
	if err := db.Create(&models.Korisnik{Username: "myuser", Password: string(hash), Role: ""}).Error; err != nil {
		t.Fatal(err)
	}
	status, _ := callRegisterOpen(t, db, validOpenRegisterPayload("MyUser"))
	if status != http.StatusConflict {
		t.Fatalf("expected conflict for case-insensitive duplicate, status %d", status)
	}
}

func TestRegisterOpen_WeakPasswordRejected(t *testing.T) {
	db := testRegisterOpenDB(t)
	payload := `{
		"username":"newbie",
		"password":"short",
		"email":"newbie@example.com",
		"fullName":"Test",
		"pol":"M",
		"datumRodjenja":"1990-01-15"
	}`
	status, body := callRegisterOpen(t, db, payload)
	if status != http.StatusBadRequest {
		t.Fatalf("status %d", status)
	}
	if body["error"] != "Lozinka mora imati najmanje 8 karaktera" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestRegisterOpen_MalformedEmailRejected(t *testing.T) {
	db := testRegisterOpenDB(t)
	payload := `{
		"username":"newbie",
		"password":"password12",
		"email":"not-an-email",
		"fullName":"Test",
		"pol":"M",
		"datumRodjenja":"1990-01-15"
	}`
	status, body := callRegisterOpen(t, db, payload)
	if status != http.StatusBadRequest {
		t.Fatalf("status %d", status)
	}
	if body["error"] != "Neispravna email adresa" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestRegisterOpen_MissingRequiredFields(t *testing.T) {
	db := testRegisterOpenDB(t)
	status, _ := callRegisterOpen(t, db, `{"username":"x","password":"password12"}`)
	if status != http.StatusBadRequest {
		t.Fatalf("status %d", status)
	}
}

func TestRegisterOpen_UsernameWithSpacesRejected(t *testing.T) {
	db := testRegisterOpenDB(t)
	payload := `{
		"username":"bad user",
		"password":"password12",
		"email":"bad@example.com",
		"fullName":"Test",
		"pol":"M",
		"datumRodjenja":"1990-01-15"
	}`
	status, body := callRegisterOpen(t, db, payload)
	if status != http.StatusBadRequest {
		t.Fatalf("status %d", status)
	}
	if !strings.Contains(body["error"].(string), "razmake") {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestRegisterOpen_NoUserRowCreatedBeforeEmailVerify(t *testing.T) {
	db := testRegisterOpenDB(t)
	// Email send fails in unit test → handler rolls back pending row; no Korisnik row must exist.
	callRegisterOpen(t, db, validOpenRegisterPayload("pendinguser"))
	var count int64
	db.Model(&models.Korisnik{}).Where("username = ?", "pendinguser").Count(&count)
	if count != 0 {
		t.Fatalf("user row created before verification: count=%d", count)
	}
}

func TestRegisterOpen_DoesNotAcceptPrivilegedRoleInPayload(t *testing.T) {
	db := testRegisterOpenDB(t)
	payload := `{
		"username":"hacker",
		"password":"password12",
		"email":"hacker@example.com",
		"fullName":"Test",
		"pol":"M",
		"datumRodjenja":"1990-01-15",
		"role":"superadmin",
		"isActive":true,
		"clubId":99
	}`
	callRegisterOpen(t, db, payload)
	var count int64
	db.Model(&models.Korisnik{}).Where("username = ?", "hacker").Count(&count)
	if count != 0 {
		t.Fatal("privileged fields must not create user directly")
	}
}
