package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const testLoginJWTSecret = "01234567890123456789012345678901"

func testLoginDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "auth_login")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}, &models.Klubovi{}, &models.Obavestenje{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedLoginUser(t *testing.T, db *gorm.DB, username, plainPassword, role string, klubID *uint) models.Korisnik {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	u := models.Korisnik{
		Username: username,
		Password: string(hash),
		Role:     role,
		FullName: "Test User",
		Email:    username + "@example.com",
		KlubID:   klubID,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func callLogin(t *testing.T, db *gorm.DB, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	middleware.ResetLoginAttemptsForTest()
	Login(db, []byte(testLoginJWTSecret))(c)
	return rec
}

func parseLoginJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v body=%s", err, rec.Body.String())
	}
	return body
}

func TestLogin_ValidCredentials(t *testing.T) {
	db := testLoginDB(t)
	klubID := uint(1)
	if err := db.Create(&models.Klubovi{ID: klubID, Naziv: "Club"}).Error; err != nil {
		t.Fatal(err)
	}
	seedLoginUser(t, db, "alice", "secretpass", "clan", &klubID)

	rec := callLogin(t, db, `{"username":"alice","password":"secretpass"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200, body=%s", rec.Code, rec.Body.String())
	}
	body := parseLoginJSON(t, rec)
	if body["role"] != "clan" {
		t.Fatalf("role=%v", body["role"])
	}
	token, ok := body["token"].(string)
	if !ok || len(token) < 20 {
		t.Fatalf("missing token")
	}
	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		return []byte(testLoginJWTSecret), nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("token invalid: %v", err)
	}
	if claims["username"] != "alice" {
		t.Fatalf("username claim=%v", claims["username"])
	}
	if claims["role"] != "clan" {
		t.Fatalf("role claim=%v", claims["role"])
	}
	exp, ok := claims["exp"].(float64)
	if !ok || int64(exp) <= time.Now().Unix() {
		t.Fatalf("exp not in future: %v", claims["exp"])
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	db := testLoginDB(t)
	seedLoginUser(t, db, "alice", "secretpass", "clan", nil)

	rec := callLogin(t, db, `{"username":"alice","password":"wrong"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
	body := parseLoginJSON(t, rec)
	if body["error"] != "Pogrešno korisničko ime ili lozinka" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestLogin_UnknownUsername(t *testing.T) {
	db := testLoginDB(t)
	rec := callLogin(t, db, `{"username":"nobody","password":"secretpass"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
	body := parseLoginJSON(t, rec)
	if body["error"] != "Pogrešno korisničko ime ili lozinka" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestLogin_EmptyUsernameAfterNormalize(t *testing.T) {
	db := testLoginDB(t)
	rec := callLogin(t, db, `{"username":"   ","password":"secretpass"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
	body := parseLoginJSON(t, rec)
	if body["error"] != "Obavezno korisničko ime" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestLogin_MissingPassword(t *testing.T) {
	db := testLoginDB(t)
	rec := callLogin(t, db, `{"username":"alice"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestLogin_MissingUsername(t *testing.T) {
	db := testLoginDB(t)
	rec := callLogin(t, db, `{"password":"secretpass"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestLogin_WhitespaceUsernameTrimmed(t *testing.T) {
	db := testLoginDB(t)
	klubID := uint(1)
	if err := db.Create(&models.Klubovi{ID: klubID, Naziv: "Club"}).Error; err != nil {
		t.Fatal(err)
	}
	seedLoginUser(t, db, "alice", "secretpass", "clan", &klubID)

	rec := callLogin(t, db, `{"username":"  Alice  ","password":"secretpass"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestLogin_MalformedJSON(t *testing.T) {
	db := testLoginDB(t)
	rec := callLogin(t, db, `{not json`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
	body := parseLoginJSON(t, rec)
	if body["error"] != "Nevažeći format zahteva" {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestLogin_PasswordNeverInResponse(t *testing.T) {
	db := testLoginDB(t)
	seedLoginUser(t, db, "alice", "secretpass", "clan", nil)

	rec := callLogin(t, db, `{"username":"alice","password":"secretpass"}`)
	raw := rec.Body.String()
	if strings.Contains(strings.ToLower(raw), "secretpass") {
		t.Fatalf("password leaked in response: %s", raw)
	}
	if strings.Contains(raw, `"password"`) {
		t.Fatalf("password field in response: %s", raw)
	}
	if strings.Contains(raw, "$2a$") || strings.Contains(raw, "$2b$") {
		t.Fatalf("bcrypt hash in response: %s", raw)
	}
}

func TestLogin_DeletedUserForbidden(t *testing.T) {
	db := testLoginDB(t)
	seedLoginUser(t, db, "gone", "secretpass", "deleted", nil)

	rec := callLogin(t, db, `{"username":"gone","password":"secretpass"}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d", rec.Code)
	}
	body := parseLoginJSON(t, rec)
	if body["error"] != "Nalog je deaktiviran." {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestLogin_RolesInToken(t *testing.T) {
	db := testLoginDB(t)
	klubID := uint(1)
	if err := db.Create(&models.Klubovi{ID: klubID, Naziv: "Club"}).Error; err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		username string
		role     string
		klubID   *uint
	}{
		{"admin1", "admin", &klubID},
		{"clan1", "clan", &klubID},
		{"super1", "superadmin", nil},
		{"vodic1", "vodic", &klubID},
	}
	for _, tc := range cases {
		seedLoginUser(t, db, tc.username, "secretpass", tc.role, tc.klubID)
		rec := callLogin(t, db, `{"username":"`+tc.username+`","password":"secretpass"}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status %d", tc.username, rec.Code)
		}
		body := parseLoginJSON(t, rec)
		if body["role"] != tc.role {
			t.Fatalf("%s role=%v", tc.username, body["role"])
		}
	}
}

func TestLogin_DoesNotChangePasswordHash(t *testing.T) {
	db := testLoginDB(t)
	u := seedLoginUser(t, db, "alice", "secretpass", "clan", nil)
	var before models.Korisnik
	if err := db.First(&before, u.ID).Error; err != nil {
		t.Fatal(err)
	}

	rec := callLogin(t, db, `{"username":"alice","password":"secretpass"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var after models.Korisnik
	if err := db.First(&after, u.ID).Error; err != nil {
		t.Fatal(err)
	}
	if after.Password != before.Password {
		t.Fatal("password hash changed on login")
	}
}

func TestLogin_ParallelRequestsStable(t *testing.T) {
	db := testLoginDB(t)
	seedLoginUser(t, db, "alice", "secretpass", "clan", nil)

	var wg sync.WaitGroup
	errCh := make(chan string, 10)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rec := callLogin(t, db, `{"username":"alice","password":"secretpass"}`)
			if rec.Code != http.StatusOK {
				errCh <- rec.Body.String()
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for msg := range errCh {
		t.Fatalf("parallel login failed: %s", msg)
	}
}

func TestLogin_RememberMeLongerExpiry(t *testing.T) {
	db := testLoginDB(t)
	seedLoginUser(t, db, "alice", "secretpass", "clan", nil)

	shortRec := callLogin(t, db, `{"username":"alice","password":"secretpass"}`)
	longRec := callLogin(t, db, `{"username":"alice","password":"secretpass","remember_me":true}`)
	if shortRec.Code != http.StatusOK || longRec.Code != http.StatusOK {
		t.Fatal("login failed")
	}
	shortBody := parseLoginJSON(t, shortRec)
	longBody := parseLoginJSON(t, longRec)

	parseExp := func(token string) int64 {
		claims := jwt.MapClaims{}
		_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
			return []byte(testLoginJWTSecret), nil
		})
		if err != nil {
			t.Fatal(err)
		}
		return int64(claims["exp"].(float64))
	}
	shortExp := parseExp(shortBody["token"].(string))
	longExp := parseExp(longBody["token"].(string))
	if longExp <= shortExp {
		t.Fatalf("remember_me exp not longer: short=%d long=%d", shortExp, longExp)
	}
}

func TestLogin_ClubOnHoldForbidden(t *testing.T) {
	db := testLoginDB(t)
	club := models.Klubovi{Naziv: "Hold Club", OnHold: true}
	if err := db.Create(&club).Error; err != nil {
		t.Fatal(err)
	}
	klubID := club.ID
	seedLoginUser(t, db, "member", "secretpass", "clan", &klubID)

	rec := callLogin(t, db, `{"username":"member","password":"secretpass"}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
	body := parseLoginJSON(t, rec)
	if !strings.Contains(body["error"].(string), "suspendovan") {
		t.Fatalf("error=%v", body["error"])
	}
}

func TestLogin_GenericErrorForUnknownAndWrongPassword(t *testing.T) {
	db := testLoginDB(t)
	seedLoginUser(t, db, "alice", "secretpass", "clan", nil)

	unknown := callLogin(t, db, `{"username":"missing","password":"x"}`)
	wrong := callLogin(t, db, `{"username":"alice","password":"x"}`)
	if unknown.Code != http.StatusUnauthorized || wrong.Code != http.StatusUnauthorized {
		t.Fatalf("statuses %d %d", unknown.Code, wrong.Code)
	}
	uBody := parseLoginJSON(t, unknown)
	wBody := parseLoginJSON(t, wrong)
	if uBody["error"] != wBody["error"] {
		t.Fatalf("different errors leak username existence: %v vs %v", uBody["error"], wBody["error"])
	}
}

func TestLogin_VeryLongPasswordRejectedByBcryptCompare(t *testing.T) {
	db := testLoginDB(t)
	seedLoginUser(t, db, "alice", "secretpass", "clan", nil)
	longPass := strings.Repeat("a", 200)
	rec := callLogin(t, db, `{"username":"alice","password":"`+longPass+`"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestLogout_ClearsCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	Logout()(c)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	cookies := rec.Result().Cookies()
	found := false
	for _, ck := range cookies {
		if ck.Name == "auth_token" && ck.MaxAge < 0 {
			found = true
		}
	}
	if !found {
		t.Fatal("auth_token cookie not cleared")
	}
}

func TestLogout_IdempotentWithoutCookieOrAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	req.Header.Set("Authorization", "Bearer not.a.valid.jwt")
	c.Request = req
	Logout()(c)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
	cookies := rec.Result().Cookies()
	for _, ck := range cookies {
		if ck.Name == "auth_token" {
			if ck.MaxAge >= 0 {
				t.Fatalf("expected deletion cookie, got MaxAge=%d", ck.MaxAge)
			}
			if ck.Path != "/" {
				t.Fatalf("Path=%q want /", ck.Path)
			}
			if !ck.HttpOnly {
				t.Fatal("expected HttpOnly on clear cookie")
			}
		}
	}
}

func TestLogin_ResponseUserPayloadShape(t *testing.T) {
	db := testLoginDB(t)
	klubID := uint(3)
	club := models.Klubovi{ID: klubID, Naziv: "Test"}
	if err := db.Create(&club).Error; err != nil {
		t.Fatal(err)
	}
	seedLoginUser(t, db, "alice", "secretpass", "clan", &klubID)

	rec := callLogin(t, db, `{"username":"alice","password":"secretpass"}`)
	body := parseLoginJSON(t, rec)
	user, ok := body["user"].(map[string]any)
	if !ok {
		t.Fatalf("user payload missing: %v", body["user"])
	}
	if user["username"] != "alice" {
		t.Fatalf("username=%v", user["username"])
	}
	if _, hasKlub := user["klubId"]; !hasKlub {
		t.Fatal("klubId missing for club member")
	}
}

func TestLogin_EmptyJSONBody(t *testing.T) {
	db := testLoginDB(t)
	rec := callLogin(t, db, `{}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestLogin_UsernameCaseInsensitiveMatch(t *testing.T) {
	db := testLoginDB(t)
	klubID := uint(1)
	if err := db.Create(&models.Klubovi{ID: klubID, Naziv: "Club"}).Error; err != nil {
		t.Fatal(err)
	}
	seedLoginUser(t, db, "alice", "secretpass", "clan", &klubID)

	rec := callLogin(t, db, `{"username":"ALICE","password":"secretpass"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
}
