package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func testUpdateMeEmailDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := testdb.MemoryDSN(t, "handlers")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Korisnik{},
		&models.EmailVerificationToken{},
		&models.PasswordResetToken{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedVerifiedUser(t *testing.T, db *gorm.DB, username, email, plainPassword string) models.Korisnik {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	dob := time.Date(1990, 1, 15, 0, 0, 0, 0, time.UTC)
	u := models.Korisnik{
		Username: username, Password: string(hash), Role: "clan",
		FullName: "Email User", Email: email, Pol: "M",
		DatumRodjenja: &dob, EmailVerifiedAt: &now,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func seedUnverifiedUser(t *testing.T, db *gorm.DB, username, email, plainPassword string) models.Korisnik {
	t.Helper()
	u := seedVerifiedUser(t, db, username, email, plainPassword)
	if err := db.Model(&u).Update("email_verified_at", nil).Error; err != nil {
		t.Fatal(err)
	}
	u.EmailVerifiedAt = nil
	return u
}

func createActiveEmailToken(t *testing.T, db *gorm.DB, userID uint) (raw string, row models.EmailVerificationToken) {
	t.Helper()
	raw, hash, err := helpers.GenerateEmailVerificationToken()
	if err != nil {
		t.Fatal(err)
	}
	row = models.EmailVerificationToken{
		UserID: userID, TokenHash: hash, ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatal(err)
	}
	return raw, row
}

func createPasswordResetToken(t *testing.T, db *gorm.DB, userID uint) models.PasswordResetToken {
	t.Helper()
	_, hash, err := helpers.GenerateEmailVerificationToken()
	if err != nil {
		t.Fatal(err)
	}
	row := models.PasswordResetToken{
		UserID: userID, TokenHash: hash, ExpiresAt: time.Now().Add(30 * time.Minute),
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatal(err)
	}
	return row
}

func callVerifyEmail(t *testing.T, db *gorm.DB, rawToken string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodGet, "/api/email/verify?token="+rawToken, nil)
	c.Request = req
	c.Set("db", db)
	VerifyEmail(c)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body
}

func TestUpdateMe_NameChange_KeepsVerifiedAndToken(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_name", "name@example.com", "oldpass12")
	raw, token := createActiveEmailToken(t, db, u.ID)
	_ = raw

	fields := baseProfileFields(u)
	fields["fullName"] = "Changed Name"
	code, _, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.FullName != "Changed Name" {
		t.Fatalf("fullName=%q", reloaded.FullName)
	}
	if reloaded.EmailVerifiedAt == nil {
		t.Fatal("verified status must stay")
	}
	var still models.EmailVerificationToken
	if err := db.First(&still, token.ID).Error; err != nil {
		t.Fatal("token must remain", err)
	}
	if still.UsedAt != nil {
		t.Fatal("token must not be invalidated on name-only update")
	}
}

func TestUpdateMe_SameEmail_KeepsVerified(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_same", "same@example.com", "oldpass12")
	_, token := createActiveEmailToken(t, db, u.ID)

	fields := baseProfileFields(u)
	fields["email"] = "same@example.com"
	fields["fullName"] = "Same Email"
	code, _, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.EmailVerifiedAt == nil {
		t.Fatal("same email must keep verified")
	}
	var still models.EmailVerificationToken
	if err := db.First(&still, token.ID).Error; err != nil {
		t.Fatal(err)
	}
	if still.UsedAt != nil {
		t.Fatal("token must remain for same email")
	}
}

func TestUpdateMe_SameEmail_CaseTrim_KeepsVerified(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_case", "case@example.com", "oldpass12")

	fields := baseProfileFields(u)
	fields["email"] = "  CASE@example.com  "
	code, body, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Email != "case@example.com" {
		t.Fatalf("email=%q", reloaded.Email)
	}
	if reloaded.EmailVerifiedAt == nil {
		t.Fatal("case/trim-equivalent email must keep verified")
	}
	if k, ok := body["korisnik"].(map[string]any); ok {
		if k["email_verified_at"] == nil {
			t.Fatal("response must still show verified")
		}
	}
}

func TestUpdateMe_EmailChange_ResetsVerified(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_chg", "old@example.com", "oldpass12")

	fields := baseProfileFields(u)
	fields["email"] = "new@example.com"
	fields["fullName"] = "After Email"
	code, body, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Email != "new@example.com" {
		t.Fatalf("email=%q", reloaded.Email)
	}
	if reloaded.EmailVerifiedAt != nil {
		t.Fatal("verified must reset on email change")
	}
	if reloaded.FullName != "After Email" {
		t.Fatalf("fullName=%q", reloaded.FullName)
	}
	k, ok := body["korisnik"].(map[string]any)
	if !ok {
		t.Fatal("missing korisnik")
	}
	if k["email"] != "new@example.com" {
		t.Fatalf("response email=%v", k["email"])
	}
	if _, has := k["email_verified_at"]; has && k["email_verified_at"] != nil {
		t.Fatalf("response must not show verified, got %v", k["email_verified_at"])
	}
	if _, has := k["password"]; has {
		t.Fatal("password leaked")
	}
}

func TestUpdateMe_UnverifiedEmailChange_StaysUnverified(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedUnverifiedUser(t, db, "em_unv", "old-unv@example.com", "oldpass12")

	fields := baseProfileFields(u)
	fields["email"] = "new-unv@example.com"
	code, _, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Email != "new-unv@example.com" || reloaded.EmailVerifiedAt != nil {
		t.Fatal("must stay unverified with new email")
	}
}

func TestUpdateMe_DuplicateEmail_NoPartialUpdate(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	a := seedVerifiedUser(t, db, "em_dup_a", "a@example.com", "oldpass12")
	_ = seedVerifiedUser(t, db, "em_dup_b", "taken@example.com", "oldpass12")
	oldVerified := a.EmailVerifiedAt

	fields := baseProfileFields(a)
	fields["email"] = "taken@example.com"
	fields["fullName"] = "Should Not Save"
	code, body, _ := callUpdateMe(t, db, a.Username, fields)
	if code != http.StatusConflict {
		t.Fatalf("status=%d want 409", code)
	}
	if body["error"] != "Email adresa je već u upotrebi" {
		t.Fatalf("error=%v", body["error"])
	}
	reloaded := reloadUpdateMeUser(t, db, a.ID)
	if reloaded.Email != "a@example.com" || reloaded.FullName != "Email User" {
		t.Fatal("no fields may change on duplicate email")
	}
	if reloaded.EmailVerifiedAt == nil || !reloaded.EmailVerifiedAt.Equal(*oldVerified) {
		t.Fatal("verified must stay on duplicate rejection")
	}
}

func TestUpdateMe_InvalidEmail_NoUpdate(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_bad", "bad@example.com", "oldpass12")

	fields := baseProfileFields(u)
	fields["email"] = "not-an-email"
	fields["fullName"] = "Nope"
	code, _, _ := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d", code)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Email != "bad@example.com" || reloaded.FullName != "Email User" || reloaded.EmailVerifiedAt == nil {
		t.Fatal("no update on invalid email")
	}
}

func TestUpdateMe_EmailChange_InvalidatesOldVerificationToken(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedUnverifiedUser(t, db, "em_tok", "tok-old@example.com", "oldpass12")
	raw, token := createActiveEmailToken(t, db, u.ID)
	reset := createPasswordResetToken(t, db, u.ID)

	fields := baseProfileFields(u)
	fields["email"] = "tok-new@example.com"
	code, _, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}

	var gone models.EmailVerificationToken
	if err := db.First(&gone, token.ID).Error; err == nil {
		t.Fatal("active email verification token must be deleted after email change")
	}

	var stillReset models.PasswordResetToken
	if err := db.First(&stillReset, reset.ID).Error; err != nil {
		t.Fatal("password reset token must not be deleted", err)
	}

	vCode, vBody := callVerifyEmail(t, db, raw)
	if vCode != http.StatusBadRequest {
		t.Fatalf("old token status=%d body=%v", vCode, vBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.EmailVerifiedAt != nil {
		t.Fatal("old token must not verify new email")
	}
}

func TestUpdateMe_NewTokenAfterEmailChange_CanVerify(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_newtok", "before@example.com", "oldpass12")

	fields := baseProfileFields(u)
	fields["email"] = "after@example.com"
	if code, _, raw := callUpdateMe(t, db, u.Username, fields); code != http.StatusOK {
		t.Fatalf("update status=%d body=%s", code, raw)
	}

	raw, _ := createActiveEmailToken(t, db, u.ID)
	vCode, vBody := callVerifyEmail(t, db, raw)
	if vCode != http.StatusOK {
		t.Fatalf("verify status=%d body=%v", vCode, vBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Email != "after@example.com" || reloaded.EmailVerifiedAt == nil {
		t.Fatal("new token must verify current email")
	}
}

func TestUpdateMe_TokenOtherUser_CannotVerify(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	a := seedUnverifiedUser(t, db, "em_a", "a-tok@example.com", "oldpass12")
	b := seedUnverifiedUser(t, db, "em_b", "b-tok@example.com", "oldpass12")
	raw, _ := createActiveEmailToken(t, db, a.ID)

	vCode, _ := callVerifyEmail(t, db, raw)
	if vCode != http.StatusOK {
		t.Fatalf("owner token should verify owner, status=%d", vCode)
	}
	if reloadUpdateMeUser(t, db, b.ID).EmailVerifiedAt != nil {
		t.Fatal("other user must stay unverified")
	}
	if reloadUpdateMeUser(t, db, a.ID).EmailVerifiedAt == nil {
		t.Fatal("owner should be verified")
	}
}

func TestUpdateMe_ExpiredToken_CannotVerify(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedUnverifiedUser(t, db, "em_exp", "exp@example.com", "oldpass12")
	raw, hash, err := helpers.GenerateEmailVerificationToken()
	if err != nil {
		t.Fatal(err)
	}
	row := models.EmailVerificationToken{
		UserID: u.ID, TokenHash: hash, ExpiresAt: time.Now().Add(-time.Hour),
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatal(err)
	}
	vCode, vBody := callVerifyEmail(t, db, raw)
	if vCode != http.StatusBadRequest || vBody["error"] != "Token je istekao" {
		t.Fatalf("status=%d body=%v", vCode, vBody)
	}
	if reloadUpdateMeUser(t, db, u.ID).EmailVerifiedAt != nil {
		t.Fatal("expired token must not verify")
	}
}

func TestUpdateMe_PasswordAndEmail_AtomicSuccess(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_pw_ok", "pw-old@example.com", "oldpass12")

	fields := baseProfileFields(u)
	fields["email"] = "pw-new@example.com"
	fields["fullName"] = "PW Email"
	fields["currentPassword"] = "oldpass12"
	fields["newPassword"] = "newpass99"
	code, _, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Email != "pw-new@example.com" || reloaded.EmailVerifiedAt != nil || reloaded.FullName != "PW Email" {
		t.Fatal("email+profile must update and verified reset")
	}
	if bcrypt.CompareHashAndPassword([]byte(reloaded.Password), []byte("newpass99")) != nil {
		t.Fatal("password must change")
	}
}

func TestUpdateMe_PasswordAndEmail_WrongCurrent_NoChange(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_pw_bad", "pw-bad@example.com", "oldpass12")
	oldHash := u.Password

	fields := baseProfileFields(u)
	fields["email"] = "pw-bad-new@example.com"
	fields["fullName"] = "Nope"
	fields["currentPassword"] = "wrong-pass"
	fields["newPassword"] = "newpass99"
	code, _, _ := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d", code)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.Email != "pw-bad@example.com" || reloaded.FullName != "Email User" || reloaded.Password != oldHash || reloaded.EmailVerifiedAt == nil {
		t.Fatal("wrong current password must change nothing")
	}
}

func TestUpdateMe_PasswordOnly_KeepsVerified(t *testing.T) {
	db := testUpdateMeEmailDB(t)
	u := seedVerifiedUser(t, db, "em_pw_only", "pw-only@example.com", "oldpass12")

	fields := baseProfileFields(u)
	fields["currentPassword"] = "oldpass12"
	fields["newPassword"] = "newpass99"
	code, _, rawBody := callUpdateMe(t, db, u.Username, fields)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, rawBody)
	}
	reloaded := reloadUpdateMeUser(t, db, u.ID)
	if reloaded.EmailVerifiedAt == nil {
		t.Fatal("password-only change must keep verified")
	}
	if bcrypt.CompareHashAndPassword([]byte(reloaded.Password), []byte("newpass99")) != nil {
		t.Fatal("password must change")
	}
}
