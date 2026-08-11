package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"beleg-app/backend/internal/database"
	"beleg-app/backend/internal/googleidtoken"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/socialauth"
	"beleg-app/backend/internal/testdb"
	"beleg-app/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const socialTestJWT = "google-auth-test-secret-32bytes-min"

type stubGoogleVerifier struct {
	payload   *googleidtoken.Payload
	err       error
	lastToken string
}

func (s *stubGoogleVerifier) Verify(_ context.Context, raw string) (*googleidtoken.Payload, error) {
	s.lastToken = raw
	if s.err != nil {
		return nil, s.err
	}
	return s.payload, nil
}

func validGooglePayload() *googleidtoken.Payload {
	return &googleidtoken.Payload{
		Sub:           "google-sub-1",
		Email:         "irfan@example.com",
		EmailVerified: true,
		Name:          "Irfan Ćatović",
		Picture:       "https://lh3.googleusercontent.com/a/pic",
		Aud:           "web-client-id",
		Iss:           "https://accounts.google.com",
		Exp:           time.Now().Add(time.Hour).Unix(),
	}
}

func socialTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(testdb.MemoryDSN(t, "social_google")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.AuthIdentity{},
		&models.Obavestenje{},
		&models.EmailVerificationToken{},
		&models.PendingOpenRegistration{},
		&models.Klubovi{},
	); err != nil {
		t.Fatal(err)
	}
	if err := database.PostAutoMigrateCreateEmailIndexes(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func socialEngine(t *testing.T, db *gorm.DB, v googleidtoken.Verifier) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	})
	secret := []byte(socialTestJWT)
	r.POST("/api/auth/social/google", StartGoogleAuth(secret, v))
	r.POST("/api/auth/social/google/complete", CompleteGoogleOnboarding(secret))
	r.POST("/login", Login(db, secret))
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(secret))
	protected.Use(middleware.LoadUserMiddleware())
	{
		protected.POST("/auth/social/google/link", LinkGoogleAccount(secret))
		protected.GET("/me", GetMe)
	}
	return r
}

func doJSON(r http.Handler, method, path, body, bearer string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	r.ServeHTTP(rec, req)
	return rec
}

func parseJSONBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v body=%s", err, rec.Body.String())
	}
	return body
}

func countKorisnici(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.Korisnik{}).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func countIdentities(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.AuthIdentity{}).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func completePayload(token, username string) string {
	return fmt.Sprintf(
		`{"onboardingToken":%q,"username":%q,"pol":"M","datumRodjenja":"1999-01-15"}`,
		token, username,
	)
}

func TestGoogleAuth_Start_OnboardingRequiredDoesNotCreateUser(t *testing.T) {
	db := socialTestDB(t)
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)

	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
	body := parseJSONBody(t, rec)
	if body["status"] != "onboarding_required" {
		t.Fatalf("status=%v", body["status"])
	}
	if body["email"] != "irfan@example.com" {
		t.Fatalf("email=%v", body["email"])
	}
	if body["suggestedUsername"] != "irfancatovic" {
		t.Fatalf("suggestedUsername=%v", body["suggestedUsername"])
	}
	if body["onboardingToken"] == nil || body["onboardingToken"] == "" {
		t.Fatal("missing onboardingToken")
	}
	if countKorisnici(t, db) != 0 || countIdentities(t, db) != 0 {
		t.Fatalf("onboarding_required must not create rows")
	}
}

func TestGoogleAuth_Start_FrontendCannotSpoofEmail(t *testing.T) {
	db := socialTestDB(t)
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google",
		`{"idToken":"id-token","email":"spoof@evil.com","googleId":"attacker","fullName":"Hacker"}`, "")
	body := parseJSONBody(t, rec)
	if body["email"] != "irfan@example.com" {
		t.Fatalf("spoofed email accepted: %v", body["email"])
	}
	if v.lastToken != "id-token" {
		t.Fatalf("verifier token=%q", v.lastToken)
	}
}

func TestGoogleAuth_Start_InvalidVerifier(t *testing.T) {
	db := socialTestDB(t)
	r := socialEngine(t, db, &stubGoogleVerifier{err: googleidtoken.ErrInvalidToken})
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"x"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestGoogleAuth_Start_WrongAudience(t *testing.T) {
	db := socialTestDB(t)
	r := socialEngine(t, db, &stubGoogleVerifier{err: googleidtoken.ErrWrongAudience})
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"x"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestGoogleAuth_Start_Expired(t *testing.T) {
	db := socialTestDB(t)
	r := socialEngine(t, db, &stubGoogleVerifier{err: googleidtoken.ErrExpired})
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"x"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestGoogleAuth_Start_MissingSub(t *testing.T) {
	db := socialTestDB(t)
	r := socialEngine(t, db, &stubGoogleVerifier{err: googleidtoken.ErrMissingSub})
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"x"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestGoogleAuth_Start_MissingEmail(t *testing.T) {
	db := socialTestDB(t)
	r := socialEngine(t, db, &stubGoogleVerifier{err: googleidtoken.ErrMissingEmail})
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"x"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestGoogleAuth_Start_EmailUnverified(t *testing.T) {
	db := socialTestDB(t)
	r := socialEngine(t, db, &stubGoogleVerifier{err: googleidtoken.ErrEmailUnverified})
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"x"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestGoogleOnboarding_CompleteValidCreatesUserAndIdentity(t *testing.T) {
	db := socialTestDB(t)
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)

	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	token := start["onboardingToken"].(string)

	rec := doJSON(r, http.MethodPost, "/api/auth/social/google/complete", completePayload(token, "irfancatovic"), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
	body := parseJSONBody(t, rec)
	if body["status"] != "authenticated" {
		t.Fatalf("status=%v", body["status"])
	}
	if countKorisnici(t, db) != 1 || countIdentities(t, db) != 1 {
		t.Fatalf("users=%d identities=%d", countKorisnici(t, db), countIdentities(t, db))
	}

	var user models.Korisnik
	if err := db.Where("username = ?", "irfancatovic").First(&user).Error; err != nil {
		t.Fatal(err)
	}
	if user.Email != "irfan@example.com" {
		t.Fatalf("email=%s", user.Email)
	}
	if user.EmailVerifiedAt == nil {
		t.Fatal("EmailVerifiedAt nil")
	}
	if user.Password != "" {
		t.Fatalf("password=%q", user.Password)
	}
	if user.Pol != "M" {
		t.Fatalf("pol=%s", user.Pol)
	}
	if user.DatumRodjenja == nil || user.DatumRodjenja.Format("2006-01-02") != "1999-01-15" {
		t.Fatalf("dob=%v", user.DatumRodjenja)
	}
	if user.FullName != "Irfan Ćatović" {
		t.Fatalf("fullName=%s", user.FullName)
	}
	if user.KlubID != nil {
		t.Fatal("klub must be nil")
	}

	var ident models.AuthIdentity
	if err := db.Where("provider = ? AND provider_user_id = ?", models.AuthProviderGoogle, "google-sub-1").First(&ident).Error; err != nil {
		t.Fatal(err)
	}
	if ident.KorisnikID != user.ID {
		t.Fatalf("identity user=%d want %d", ident.KorisnikID, user.ID)
	}

	var tokens int64
	db.Model(&models.EmailVerificationToken{}).Count(&tokens)
	var pending int64
	db.Model(&models.PendingOpenRegistration{}).Count(&pending)
	if tokens != 0 || pending != 0 {
		t.Fatalf("verification flow leaked tokens=%d pending=%d", tokens, pending)
	}

	sessionTok := body["token"].(string)
	me := doJSON(r, http.MethodGet, "/api/me", "", sessionTok)
	if me.Code != http.StatusOK {
		t.Fatalf("me %d %s", me.Code, me.Body.String())
	}
	meBody := parseJSONBody(t, me)
	if meBody["profileIncomplete"] != false {
		t.Fatalf("profileIncomplete=%v", meBody["profileIncomplete"])
	}

	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(sessionTok, claims, func(t *jwt.Token) (any, error) {
		return []byte(socialTestJWT), nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("jwt: %v", err)
	}
	if claims["username"] != "irfancatovic" {
		t.Fatalf("username claim=%v", claims["username"])
	}
	if purpose, _ := claims["purpose"].(string); purpose != "" && purpose != "session" {
		t.Fatalf("purpose=%v", claims["purpose"])
	}
}

func TestGoogleOnboarding_UsernameCollision409(t *testing.T) {
	db := socialTestDB(t)
	if err := db.Create(&models.Korisnik{Username: "irfancatovic", Password: "x", Role: "", Email: "other@example.com"}).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google/complete",
		completePayload(start["onboardingToken"].(string), "irfancatovic"), "")
	if rec.Code != http.StatusConflict {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
	if countIdentities(t, db) != 0 {
		t.Fatal("identity created on username collision")
	}
	if countKorisnici(t, db) != 1 {
		t.Fatalf("users=%d", countKorisnici(t, db))
	}
}

func TestGoogleOnboarding_TransactionRollbackNoPartialRows(t *testing.T) {
	db := socialTestDB(t)
	if err := db.Callback().Create().Before("gorm:create").Register("fail_identity", func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "auth_identities" {
			_ = tx.AddError(fmt.Errorf("forced identity failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = db.Callback().Create().Remove("fail_identity")
	})

	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google/complete",
		completePayload(start["onboardingToken"].(string), "irfancatovic"), "")
	if rec.Code == http.StatusOK {
		t.Fatal("expected failure")
	}
	if countKorisnici(t, db) != 0 || countIdentities(t, db) != 0 {
		t.Fatalf("partial rows users=%d identities=%d", countKorisnici(t, db), countIdentities(t, db))
	}
}

func TestGoogleOnboarding_ReplayCompleteNoDuplicate(t *testing.T) {
	db := socialTestDB(t)
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	token := start["onboardingToken"].(string)
	first := doJSON(r, http.MethodPost, "/api/auth/social/google/complete", completePayload(token, "irfancatovic"), "")
	if first.Code != http.StatusOK {
		t.Fatalf("first %d %s", first.Code, first.Body.String())
	}
	second := doJSON(r, http.MethodPost, "/api/auth/social/google/complete", completePayload(token, "irfancatovic"), "")
	if second.Code != http.StatusOK && second.Code != http.StatusConflict {
		t.Fatalf("replay status %d %s", second.Code, second.Body.String())
	}
	if countKorisnici(t, db) != 1 || countIdentities(t, db) != 1 {
		t.Fatalf("users=%d identities=%d", countKorisnici(t, db), countIdentities(t, db))
	}
}

func TestGoogleOnboarding_ParallelCompleteNoDuplicate(t *testing.T) {
	db := socialTestDB(t)
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	token := start["onboardingToken"].(string)

	var wg sync.WaitGroup
	codes := make([]int, 2)
	wg.Add(2)
	for i := 0; i < 2; i++ {
		i := i
		go func() {
			defer wg.Done()
			rec := doJSON(r, http.MethodPost, "/api/auth/social/google/complete", completePayload(token, "irfancatovic"), "")
			codes[i] = rec.Code
		}()
	}
	wg.Wait()
	if countKorisnici(t, db) != 1 || countIdentities(t, db) != 1 {
		t.Fatalf("users=%d identities=%d codes=%v", countKorisnici(t, db), countIdentities(t, db), codes)
	}
}

func TestGoogleAuth_ExistingAuthIdentityLogsInSameUser(t *testing.T) {
	db := socialTestDB(t)
	now := time.Now()
	dob := time.Date(1999, 1, 15, 0, 0, 0, 0, time.UTC)
	user := models.Korisnik{
		Username: "irfancatovic", Password: "", Role: "", Email: "irfan@example.com",
		EmailVerifiedAt: &now, Pol: "M", DatumRodjenja: &dob, FullName: "Irfan Ćatović",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.AuthIdentity{KorisnikID: user.ID, Provider: models.AuthProviderGoogle, ProviderUserID: "google-sub-1"}).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	body := parseJSONBody(t, rec)
	if body["status"] != "authenticated" {
		t.Fatalf("status=%v", body["status"])
	}
	if countKorisnici(t, db) != 1 || countIdentities(t, db) != 1 {
		t.Fatal("must not create second user/identity")
	}
	userPayload := body["user"].(map[string]any)
	if userPayload["username"] != "irfancatovic" {
		t.Fatalf("user=%v", userPayload)
	}
}

func TestGoogleAuth_VerifiedExistingEmailLinksSameUser(t *testing.T) {
	db := socialTestDB(t)
	now := time.Now()
	dob := time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC)
	user := models.Korisnik{
		Username: "existing", Password: "hash", Role: "", Email: "irfan@example.com",
		EmailVerifiedAt: &now, Pol: "Ž", DatumRodjenja: &dob,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	body := parseJSONBody(t, rec)
	if body["status"] != "authenticated" {
		t.Fatalf("status=%v", body["status"])
	}
	if countKorisnici(t, db) != 1 {
		t.Fatalf("second user created")
	}
	if countIdentities(t, db) != 1 {
		t.Fatalf("identities=%d", countIdentities(t, db))
	}
	var ident models.AuthIdentity
	db.First(&ident)
	if ident.KorisnikID != user.ID {
		t.Fatalf("linked to %d want %d", ident.KorisnikID, user.ID)
	}
}

func TestGoogleAuth_UnverifiedExistingEmailLinkRequired(t *testing.T) {
	db := socialTestDB(t)
	user := models.Korisnik{Username: "staff", Password: "hash", Role: "", Email: "irfan@example.com"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, "")
	body := parseJSONBody(t, rec)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	if body["status"] != "link_required" || body["code"] != "SOCIAL_ACCOUNT_LINK_REQUIRED" {
		t.Fatalf("body=%v", body)
	}
	if body["linkToken"] == nil || body["token"] != nil {
		t.Fatalf("must return linkToken without session: %v", body)
	}
	if countIdentities(t, db) != 0 || countKorisnici(t, db) != 1 {
		t.Fatal("must not auto-link unverified email")
	}
}

func TestGoogleLink_CorrectAuthenticatedAccount(t *testing.T) {
	db := socialTestDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("secretpass"), bcrypt.MinCost)
	user := models.Korisnik{Username: "staff", Password: string(hash), Role: "", Email: "irfan@example.com"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	linkToken := start["linkToken"].(string)

	login := parseJSONBody(t, doJSON(r, http.MethodPost, "/login", `{"username":"staff","password":"secretpass"}`, ""))
	session := login["token"].(string)
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google/link", fmt.Sprintf(`{"linkToken":%q}`, linkToken), session)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	if countIdentities(t, db) != 1 {
		t.Fatalf("identities=%d", countIdentities(t, db))
	}
	var reloaded models.Korisnik
	db.First(&reloaded, user.ID)
	if reloaded.EmailVerifiedAt == nil {
		t.Fatal("EmailVerifiedAt not set on link")
	}
}

func TestGoogleLink_DifferentAccountRejected(t *testing.T) {
	db := socialTestDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("secretpass"), bcrypt.MinCost)
	a := models.Korisnik{Username: "staff", Password: string(hash), Role: "", Email: "irfan@example.com"}
	b := models.Korisnik{Username: "other", Password: string(hash), Role: "", Email: "other@example.com"}
	if err := db.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&b).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	linkToken := start["linkToken"].(string)
	login := parseJSONBody(t, doJSON(r, http.MethodPost, "/login", `{"username":"other","password":"secretpass"}`, ""))
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google/link",
		fmt.Sprintf(`{"linkToken":%q}`, linkToken), login["token"].(string))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	if countIdentities(t, db) != 0 {
		t.Fatal("must not link")
	}
}

func TestGoogleLink_ReplaySafe(t *testing.T) {
	db := socialTestDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("secretpass"), bcrypt.MinCost)
	user := models.Korisnik{Username: "staff", Password: string(hash), Role: "", Email: "irfan@example.com"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	linkToken := start["linkToken"].(string)
	login := parseJSONBody(t, doJSON(r, http.MethodPost, "/login", `{"username":"staff","password":"secretpass"}`, ""))
	session := login["token"].(string)
	first := doJSON(r, http.MethodPost, "/api/auth/social/google/link", fmt.Sprintf(`{"linkToken":%q}`, linkToken), session)
	second := doJSON(r, http.MethodPost, "/api/auth/social/google/link", fmt.Sprintf(`{"linkToken":%q}`, linkToken), session)
	if first.Code != http.StatusOK || (second.Code != http.StatusOK && second.Code != http.StatusConflict) {
		t.Fatalf("codes %d %d", first.Code, second.Code)
	}
	if countIdentities(t, db) != 1 {
		t.Fatalf("identities=%d", countIdentities(t, db))
	}
}

func TestGoogleLink_ParallelReplaySafe(t *testing.T) {
	db := socialTestDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("secretpass"), bcrypt.MinCost)
	user := models.Korisnik{Username: "staff", Password: string(hash), Role: "", Email: "irfan@example.com"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	linkToken := start["linkToken"].(string)
	login := parseJSONBody(t, doJSON(r, http.MethodPost, "/login", `{"username":"staff","password":"secretpass"}`, ""))
	session := login["token"].(string)

	var wg sync.WaitGroup
	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func() {
			defer wg.Done()
			_ = doJSON(r, http.MethodPost, "/api/auth/social/google/link", fmt.Sprintf(`{"linkToken":%q}`, linkToken), session)
		}()
	}
	wg.Wait()
	if countIdentities(t, db) != 1 {
		t.Fatalf("identities=%d", countIdentities(t, db))
	}
}

func TestGoogleAuth_DeletedUserIdentityRejected(t *testing.T) {
	db := socialTestDB(t)
	user := models.Korisnik{Username: "gone", Password: "x", Role: "deleted", Email: "irfan@example.com"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.AuthIdentity{KorisnikID: user.ID, Provider: models.AuthProviderGoogle, ProviderUserID: "google-sub-1"}).Error; err != nil {
		t.Fatal(err)
	}
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, "")
	if rec.Code != http.StatusForbidden && rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	body := parseJSONBody(t, rec)
	if body["token"] != nil {
		t.Fatal("deleted user must not receive session")
	}
}

func TestGoogleAuth_PasswordLoginCleanUnauthorized(t *testing.T) {
	db := socialTestDB(t)
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	complete := doJSON(r, http.MethodPost, "/api/auth/social/google/complete",
		completePayload(start["onboardingToken"].(string), "irfancatovic"), "")
	if complete.Code != http.StatusOK {
		t.Fatalf("complete %d %s", complete.Code, complete.Body.String())
	}
	middleware.ResetLoginAttemptsForTest()
	rec := doJSON(r, http.MethodPost, "/login", `{"username":"irfancatovic","password":"anything"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	body := parseJSONBody(t, rec)
	if body["error"] != "Pogrešno korisničko ime ili lozinka" {
		t.Fatalf("error=%v", body["error"])
	}
	if rec.Code >= 500 {
		t.Fatal("must not 500")
	}
}

func TestGoogleAuth_DuplicateNormalizedEmailProtection(t *testing.T) {
	db := socialTestDB(t)
	now := time.Now()
	if err := db.Create(&models.Korisnik{Username: "one", Password: "x", Role: "", Email: "irfan@example.com", EmailVerifiedAt: &now}).Error; err != nil {
		t.Fatal(err)
	}
	err := db.Create(&models.Korisnik{Username: "two", Password: "x", Role: "", Email: "IRFAN@example.com"}).Error
	if err == nil {
		t.Fatal("expected unique email protection")
	}
}

func TestGoogleAuth_LegacyBlankEmailsRemainSupported(t *testing.T) {
	db := socialTestDB(t)
	if err := db.Create(&models.Korisnik{Username: "legacy1", Password: "x", Role: "", Email: ""}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Korisnik{Username: "legacy2", Password: "x", Role: "", Email: ""}).Error; err != nil {
		t.Fatalf("second blank email rejected: %v", err)
	}
}

func TestGoogleOnboarding_SameEmailDifferentSubsConflict(t *testing.T) {
	db := socialTestDB(t)
	p1 := validGooglePayload()
	v := &stubGoogleVerifier{payload: p1}
	r := socialEngine(t, db, v)
	start1 := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"t1"}`, ""))
	c1 := doJSON(r, http.MethodPost, "/api/auth/social/google/complete",
		completePayload(start1["onboardingToken"].(string), "irfancatovic"), "")
	if c1.Code != http.StatusOK {
		t.Fatalf("first complete %d %s", c1.Code, c1.Body.String())
	}

	p2 := validGooglePayload()
	p2.Sub = "google-sub-2"
	v.payload = p2
	start2 := doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"t2"}`, "")
	body := parseJSONBody(t, start2)
	if body["status"] == "onboarding_required" {
		c2 := doJSON(r, http.MethodPost, "/api/auth/social/google/complete",
			completePayload(body["onboardingToken"].(string), "irfancatovic2"), "")
		if c2.Code != http.StatusConflict {
			t.Fatalf("second complete %d %s", c2.Code, c2.Body.String())
		}
	}
	if countKorisnici(t, db) != 1 {
		t.Fatalf("users=%d", countKorisnici(t, db))
	}
	if countIdentities(t, db) != 1 {
		t.Fatalf("identities=%d", countIdentities(t, db))
	}
}

func TestGoogleAuth_LinkVsOnboardingRace(t *testing.T) {
	db := socialTestDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("secretpass"), bcrypt.MinCost)
	user := models.Korisnik{Username: "staff", Password: string(hash), Role: "", Email: "irfan@example.com"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	onboarding, err := socialauth.SignOnboardingToken([]byte(socialTestJWT), models.AuthProviderGoogle, "google-sub-1", "irfan@example.com", "Irfan", "")
	if err != nil {
		t.Fatal(err)
	}
	linkToken, err := socialauth.SignLinkToken([]byte(socialTestJWT), models.AuthProviderGoogle, "google-sub-1", "irfan@example.com")
	if err != nil {
		t.Fatal(err)
	}
	r := socialEngine(t, db, &stubGoogleVerifier{payload: validGooglePayload()})
	login := parseJSONBody(t, doJSON(r, http.MethodPost, "/login", `{"username":"staff","password":"secretpass"}`, ""))
	session := login["token"].(string)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_ = doJSON(r, http.MethodPost, "/api/auth/social/google/complete", completePayload(onboarding, "irfancatovic"), "")
	}()
	go func() {
		defer wg.Done()
		_ = doJSON(r, http.MethodPost, "/api/auth/social/google/link", fmt.Sprintf(`{"linkToken":%q}`, linkToken), session)
	}()
	wg.Wait()
	if countKorisnici(t, db) != 1 {
		t.Fatalf("users=%d", countKorisnici(t, db))
	}
	if countIdentities(t, db) != 1 {
		t.Fatalf("identities=%d", countIdentities(t, db))
	}
}

func TestGoogleOnboarding_SessionJWTRejectedAsOnboardingToken(t *testing.T) {
	db := socialTestDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("secretpass"), bcrypt.MinCost)
	if err := db.Create(&models.Korisnik{Username: "alice", Password: string(hash), Role: "", Email: "a@b.com"}).Error; err != nil {
		t.Fatal(err)
	}
	r := socialEngine(t, db, &stubGoogleVerifier{payload: validGooglePayload()})
	login := parseJSONBody(t, doJSON(r, http.MethodPost, "/login", `{"username":"alice","password":"secretpass"}`, ""))
	rec := doJSON(r, http.MethodPost, "/api/auth/social/google/complete",
		completePayload(login["token"].(string), "irfancatovic"), "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
}

func TestGoogleAuth_OnboardingTokenRejectedByAuthMiddleware(t *testing.T) {
	db := socialTestDB(t)
	v := &stubGoogleVerifier{payload: validGooglePayload()}
	r := socialEngine(t, db, v)
	start := parseJSONBody(t, doJSON(r, http.MethodPost, "/api/auth/social/google", `{"idToken":"id-token"}`, ""))
	rec := doJSON(r, http.MethodGet, "/api/me", "", start["onboardingToken"].(string))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
}
