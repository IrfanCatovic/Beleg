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
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func testGetMeDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "get_me")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func callGetMe(t *testing.T, db *gorm.DB, username string) (int, map[string]any, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/me", nil)
	c.Set("db", db)
	if username != "" {
		c.Set("username", username)
	}
	GetMe(c)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body, rec.Body.String()
}

func TestGetMe_ValidSessionReturnsUser(t *testing.T) {
	db := testGetMeDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	dob := time.Date(1990, 5, 1, 0, 0, 0, 0, time.UTC)
	u := models.Korisnik{
		Username: "alice", Password: string(hash), Role: "clan",
		FullName: "Alice A", Email: "alice@example.com", Pol: "M", DatumRodjenja: &dob,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	status, body, raw := callGetMe(t, db, "alice")
	if status != http.StatusOK {
		t.Fatalf("status %d", status)
	}
	if body["username"] != "alice" || body["role"] != "clan" {
		t.Fatalf("body=%v", body)
	}
	if strings.Contains(raw, `"password"`) || strings.Contains(raw, "$2") {
		t.Fatalf("password/hash leaked: %s", raw)
	}
}

func TestGetMe_NoUsernameInContext401(t *testing.T) {
	db := testGetMeDB(t)
	status, body, _ := callGetMe(t, db, "")
	if status != http.StatusUnauthorized {
		t.Fatalf("status %d", status)
	}
	if body["error"] != "Niste ulogovani" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestGetMe_UserNotFound404(t *testing.T) {
	db := testGetMeDB(t)
	status, _, _ := callGetMe(t, db, "missing")
	if status != http.StatusNotFound {
		t.Fatalf("status %d", status)
	}
}

func TestGetMe_ReflectsUpdatedUsernameFromDB(t *testing.T) {
	db := testGetMeDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "alice", Password: string(hash), Role: "clan", FullName: "Alice"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&u).Update("username", "alice2").Error; err != nil {
		t.Fatal(err)
	}

	status, body, _ := callGetMe(t, db, "alice2")
	if status != http.StatusOK {
		t.Fatalf("status %d", status)
	}
	if body["username"] != "alice2" {
		t.Fatalf("username=%v", body["username"])
	}
}

func TestGetMe_ReflectsUpdatedRoleFromDB(t *testing.T) {
	db := testGetMeDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "alice", Password: string(hash), Role: "clan", FullName: "Alice"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&u).Update("role", "admin").Error; err != nil {
		t.Fatal(err)
	}

	status, body, _ := callGetMe(t, db, "alice")
	if status != http.StatusOK {
		t.Fatalf("status %d", status)
	}
	if body["role"] != "admin" {
		t.Fatalf("role=%v", body["role"])
	}
}

func TestGetMe_DoesNotUseClientSuppliedUserID(t *testing.T) {
	db := testGetMeDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "alice", Password: string(hash), Role: "clan", FullName: "Alice"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodGet, "/api/me?userId=99999", nil)
	c.Request = req
	c.Set("db", db)
	c.Set("username", "alice")
	GetMe(c)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if int(body["id"].(float64)) != int(u.ID) {
		t.Fatalf("id=%v want %d", body["id"], u.ID)
	}
}
