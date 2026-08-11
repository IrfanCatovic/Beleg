package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testMiddlewareJWTSecret = "01234567890123456789012345678901"

func signTestToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	if claims["exp"] == nil {
		claims["exp"] = time.Now().Add(time.Hour).Unix()
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(testMiddlewareJWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func runAuthProtected(t *testing.T, authHeader string) (status int, handlerCalled bool) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	called := false
	r := gin.New()
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.GET("/protected", func(c *gin.Context) {
		called = true
		role, _ := c.Get("role")
		c.JSON(http.StatusOK, gin.H{
			"username": c.GetString("username"),
			"role":     role,
		})
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	r.ServeHTTP(w, req)
	return w.Code, called
}

func TestAuthMiddleware_NoAuthorizationHeader(t *testing.T) {
	status, called := runAuthProtected(t, "")
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_EmptyBearer(t *testing.T) {
	status, called := runAuthProtected(t, "Bearer ")
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_BearerOnly(t *testing.T) {
	status, called := runAuthProtected(t, "Bearer")
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_WrongScheme(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{"username": "alice", "role": "clan"})
	status, called := runAuthProtected(t, "Basic "+token)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_MalformedJWT(t *testing.T) {
	status, called := runAuthProtected(t, "Bearer not.a.jwt")
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_ExpiredJWT(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{
		"username": "alice",
		"role":     "clan",
		"exp":      time.Now().Add(-time.Hour).Unix(),
	})
	status, called := runAuthProtected(t, "Bearer "+token)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_TamperedJWT(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{"username": "alice", "role": "clan"})
	tampered := token[:len(token)-2] + "xx"
	status, called := runAuthProtected(t, "Bearer "+tampered)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_WrongSecret(t *testing.T) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": "alice",
		"role":     "clan",
		"exp":      time.Now().Add(time.Hour).Unix(),
	})
	s, err := token.SignedString([]byte("wrong-secret-wrong-secret-wrong-sec"))
	if err != nil {
		t.Fatal(err)
	}
	status, called := runAuthProtected(t, "Bearer "+s)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_ValidJWT(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{"username": "Alice", "role": "admin"})
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.GET("/ok", func(c *gin.Context) {
		if c.GetString("username") != "alice" {
			c.Status(http.StatusInternalServerError)
			return
		}
		if c.GetString("role") != "admin" {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
}

func TestAuthMiddleware_MissingUsernameClaim(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{"role": "clan"})
	status, called := runAuthProtected(t, "Bearer "+token)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("missing username must be unauthorized: status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_ShortTokenRejected(t *testing.T) {
	status, called := runAuthProtected(t, "Bearer short")
	if status != http.StatusUnauthorized || called {
		t.Fatalf("status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_MalformedTokenNoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("panic: %v", r)
		}
	}()
	_, _ = runAuthProtected(t, "Bearer "+string(make([]byte, 50)))
}

func TestGetTokenFromRequest_BearerPreferredOverCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer from-header")
	req.AddCookie(&http.Cookie{Name: "auth_token", Value: "from-cookie"})
	c.Request = req
	if got := GetTokenFromRequest(c); got != "from-header" {
		t.Fatalf("got %q", got)
	}
}

func TestAuthMiddleware_RoleComesFromTokenNotRequest(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{"username": "alice", "role": "admin"})
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.GET("/ok", func(c *gin.Context) {
		// Handler must not trust body role over JWT context.
		if c.GetString("role") != "admin" {
			c.Status(http.StatusForbidden)
			return
		}
		c.Status(http.StatusOK)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
}

func TestLoadUserMiddleware_UserNotFoundAfterValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testMiddlewareDB(t)
	token := signTestToken(t, jwt.MapClaims{"username": "ghost", "role": "clan"})

	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("db", db) })
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.Use(LoadUserMiddleware())
	r.GET("/ok", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthMiddleware_RejectsSocialOnboardingPurpose(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{
		"username": "alice",
		"role":     "",
		"purpose":  "social_onboarding",
		"type":     "social_onboarding",
	})
	status, called := runAuthProtected(t, "Bearer "+token)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("social onboarding token must not authenticate: status=%d called=%v", status, called)
	}
}

func TestAuthMiddleware_RejectsSocialLinkPurpose(t *testing.T) {
	token := signTestToken(t, jwt.MapClaims{
		"username": "alice",
		"role":     "",
		"purpose":  "social_link",
		"type":     "social_link",
	})
	status, called := runAuthProtected(t, "Bearer "+token)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("social link token must not authenticate: status=%d called=%v", status, called)
	}
}
