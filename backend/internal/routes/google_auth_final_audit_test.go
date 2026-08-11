package routes

import (
	"strings"
	"testing"

	"beleg-app/backend/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func googleAuthAuditEngine(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dsn := testdb.MemoryDSN(t, "routes")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	r := gin.New()
	RegisterAppRoutes(r, db, []byte("google-auth-final-audit-secret-32b"))
	return r
}

func routeSet(r *gin.Engine) map[string]bool {
	out := make(map[string]bool)
	for _, rt := range r.Routes() {
		out[rt.Method+" "+rt.Path] = true
	}
	return out
}

// GAUTH-MISSING-ROUTE: expected Google/social endpoints are not registered.
func TestGoogleAuthFinalAudit_SocialRoutesExist(t *testing.T) {
	found := routeSet(googleAuthAuditEngine(t))
	candidates := []string{
		"POST /api/auth/social/google",
		"POST /api/auth/social/google/complete",
		"POST /api/auth/social/google/link",
		"POST /api/auth/google",
		"POST /api/auth/social",
		"POST /api/auth/google/complete",
		"POST /api/auth/google/onboarding",
		"POST /api/auth/google/link",
	}
	var any bool
	for _, p := range candidates {
		if found[p] {
			any = true
			break
		}
	}
	if !any {
		t.Fatalf("GAUTH-MISSING-1 P0: no Google/social auth route registered (looked for %s)", strings.Join(candidates, ", "))
	}
}

func TestGoogleAuthFinalAudit_ClassicAuthRoutesStillPresent(t *testing.T) {
	found := routeSet(googleAuthAuditEngine(t))
	required := []string{
		"POST /login",
		"POST /api/login",
		"POST /api/logout",
		"POST /api/register/open",
		"GET /api/email/verify",
		"POST /api/email/resend",
		"POST /api/password/forgot",
		"POST /api/password/reset",
		"GET /api/me",
	}
	for _, p := range required {
		if !found[p] {
			t.Errorf("classic auth route missing: %s", p)
		}
	}
}
