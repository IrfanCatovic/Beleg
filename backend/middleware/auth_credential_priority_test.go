package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Credential priority matrix for AUTH final audit — documents Bearer-first, cookie-fallback rules.
// Invalid non-empty Bearer intentionally blocks valid cookie (no second-chance path).

func runAuthProtectedWithCookie(t *testing.T, authHeader string, cookieToken string) (status int, handlerCalled bool, body string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	called := false
	r := gin.New()
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.GET("/protected", func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	if cookieToken != "" {
		req.AddCookie(&http.Cookie{Name: "auth_token", Value: cookieToken})
	}
	r.ServeHTTP(w, req)
	return w.Code, called, w.Body.String()
}

func validTestToken(t *testing.T, username string) string {
	t.Helper()
	return signTestToken(t, jwt.MapClaims{"username": username, "role": "clan"})
}

func expiredTestToken(t *testing.T, username string) string {
	t.Helper()
	return signTestToken(t, jwt.MapClaims{
		"username": username,
		"role":     "clan",
		"exp":      time.Now().Add(-time.Hour).Unix(),
	})
}

func tamperedTestToken(t *testing.T, username string) string {
	t.Helper()
	token := validTestToken(t, username)
	return token[:len(token)-2] + "xx"
}

func TestCredentialPriority_ValidBearerNoCookie(t *testing.T) {
	token := validTestToken(t, "alice")
	status, called, _ := runAuthProtectedWithCookie(t, "Bearer "+token, "")
	if status != http.StatusOK || !called {
		t.Fatalf("valid Bearer without cookie: status=%d called=%v", status, called)
	}
}

func TestCredentialPriority_NoBearerValidCookie(t *testing.T) {
	token := validTestToken(t, "alice")
	status, called, _ := runAuthProtectedWithCookie(t, "", token)
	if status != http.StatusOK || !called {
		t.Fatalf("cookie-only auth must succeed: status=%d called=%v", status, called)
	}
}

func TestCredentialPriority_ValidBearerAndCookieSameUser(t *testing.T) {
	token := validTestToken(t, "alice")
	status, called, _ := runAuthProtectedWithCookie(t, "Bearer "+token, token)
	if status != http.StatusOK || !called {
		t.Fatalf("Bearer+cookie same user: status=%d called=%v", status, called)
	}
}

func TestCredentialPriority_ValidBearerUserA_ValidCookieUserB_BearerWins(t *testing.T) {
	bearer := validTestToken(t, "alice")
	cookie := validTestToken(t, "bob")
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.GET("/protected", func(c *gin.Context) {
		if c.GetString("username") != "alice" {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+bearer)
	req.AddCookie(&http.Cookie{Name: "auth_token", Value: cookie})
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Bearer must win over cookie: status %d", w.Code)
	}
}

func TestCredentialPriority_InvalidBearerBlocksValidCookie(t *testing.T) {
	cookie := validTestToken(t, "alice")
	status, called, body := runAuthProtectedWithCookie(t, "Bearer not.a.jwt", cookie)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("invalid Bearer must block cookie fallback: status=%d called=%v body=%s", status, called, body)
	}
	if body == "" {
		t.Fatal("expected error body")
	}
}

func TestCredentialPriority_EmptyBearerFallsBackToValidCookie(t *testing.T) {
	cookie := validTestToken(t, "alice")
	status, called, _ := runAuthProtectedWithCookie(t, "Bearer ", cookie)
	if status != http.StatusOK || !called {
		t.Fatalf("empty Bearer must fall back to cookie: status=%d called=%v", status, called)
	}
}

func TestCredentialPriority_ExpiredBearerBlocksValidCookie(t *testing.T) {
	bearer := expiredTestToken(t, "alice")
	cookie := validTestToken(t, "alice")
	status, called, _ := runAuthProtectedWithCookie(t, "Bearer "+bearer, cookie)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("expired Bearer must block valid cookie: status=%d called=%v", status, called)
	}
}

func TestCredentialPriority_TamperedBearerBlocksValidCookie(t *testing.T) {
	bearer := tamperedTestToken(t, "alice")
	cookie := validTestToken(t, "alice")
	status, called, _ := runAuthProtectedWithCookie(t, "Bearer "+bearer, cookie)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("tampered Bearer must block valid cookie: status=%d called=%v", status, called)
	}
}

func TestCredentialPriority_WrongSchemeFallsBackToValidCookie(t *testing.T) {
	cookie := validTestToken(t, "alice")
	status, called, _ := runAuthProtectedWithCookie(t, "Basic not-a-jwt", cookie)
	if status != http.StatusOK || !called {
		t.Fatalf("non-Bearer scheme must allow cookie fallback: status=%d called=%v", status, called)
	}
}
