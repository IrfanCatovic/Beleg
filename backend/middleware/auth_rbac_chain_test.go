package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// requireAnyRoleMirror mirrors handlers.RequireAnyRole without importing handlers
// (avoids middleware ↔ handlers import cycle).
func requireAnyRoleMirror(c *gin.Context, message string, roles ...string) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	for _, allowed := range roles {
		if role == allowed {
			return true
		}
	}
	c.JSON(http.StatusForbidden, gin.H{"error": message})
	return false
}

func TestRBAC_AdminDemotedToClan_OldTokenForbidden(t *testing.T) {
	gdb := testMiddlewareDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "admin1", Password: string(hash), Role: "admin", FullName: "Admin"}
	if err := gdb.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	token := signTestToken(t, jwt.MapClaims{"username": "admin1", "role": "admin"})
	handlerCalls := 0
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("db", gdb); c.Next() })
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.Use(LoadUserMiddleware())
	r.GET("/admin-only", func(c *gin.Context) {
		if !requireAnyRoleMirror(c, "Samo admin", "admin", "superadmin") {
			return
		}
		handlerCalls++
		c.Status(http.StatusOK)
	})

	w1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/admin-only", nil)
	req1.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("first status %d body=%s", w1.Code, w1.Body.String())
	}
	if handlerCalls != 1 {
		t.Fatalf("handlerCalls=%d", handlerCalls)
	}

	if err := gdb.Model(&u).Update("role", "clan").Error; err != nil {
		t.Fatal(err)
	}

	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/admin-only", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("after demote status %d body=%s", w2.Code, w2.Body.String())
	}
	if handlerCalls != 1 {
		t.Fatalf("handler must not run after demote: calls=%d", handlerCalls)
	}
}

func TestRBAC_ClanPromotedToAdmin_OldTokenAllowed(t *testing.T) {
	gdb := testMiddlewareDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "clan1", Password: string(hash), Role: "clan", FullName: "Clan"}
	if err := gdb.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	token := signTestToken(t, jwt.MapClaims{"username": "clan1", "role": "clan"})
	handlerCalls := 0
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("db", gdb); c.Next() })
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.Use(LoadUserMiddleware())
	r.GET("/admin-only", func(c *gin.Context) {
		if !requireAnyRoleMirror(c, "Samo admin", "admin", "superadmin") {
			return
		}
		handlerCalls++
		c.Status(http.StatusOK)
	})

	w1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/admin-only", nil)
	req1.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusForbidden {
		t.Fatalf("clan first status %d", w1.Code)
	}

	if err := gdb.Model(&u).Update("role", "admin").Error; err != nil {
		t.Fatal(err)
	}

	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/admin-only", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("after promote status %d body=%s", w2.Code, w2.Body.String())
	}
	if handlerCalls != 1 {
		t.Fatalf("handlerCalls=%d", handlerCalls)
	}
}

func TestRBAC_DeletedAfterLogin_OldTokenRejected(t *testing.T) {
	gdb := testMiddlewareDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "active1", Password: string(hash), Role: "clan", FullName: "Active"}
	if err := gdb.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	token := signTestToken(t, jwt.MapClaims{"username": "active1", "role": "clan"})

	handlerCalls := 0
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("db", gdb); c.Next() })
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.Use(LoadUserMiddleware())
	r.GET("/ok", func(c *gin.Context) {
		handlerCalls++
		c.Status(http.StatusOK)
	})

	w1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req1.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("active status %d", w1.Code)
	}

	if err := gdb.Model(&u).Update("role", "deleted").Error; err != nil {
		t.Fatal(err)
	}

	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusUnauthorized {
		t.Fatalf("deleted status %d body=%s", w2.Code, w2.Body.String())
	}
	if handlerCalls != 1 {
		t.Fatalf("handler must not run for deleted: calls=%d", handlerCalls)
	}
}

func TestRBAC_UserDeletedFromDB_OldTokenRejected(t *testing.T) {
	gdb := testMiddlewareDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "gone1", Password: string(hash), Role: "clan", FullName: "Gone"}
	if err := gdb.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	token := signTestToken(t, jwt.MapClaims{"username": "gone1", "role": "clan"})

	handlerCalls := 0
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("db", gdb); c.Next() })
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.Use(LoadUserMiddleware())
	r.GET("/ok", func(c *gin.Context) {
		handlerCalls++
		c.Status(http.StatusOK)
	})

	if err := gdb.Delete(&u).Error; err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status %d body=%s", w.Code, w.Body.String())
	}
	if handlerCalls != 0 {
		t.Fatalf("handler called: %d", handlerCalls)
	}
}

func TestLoadUser_OverwritesJWTRoleWithDBRole(t *testing.T) {
	gdb := testMiddlewareDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "alice", Password: string(hash), Role: "admin", FullName: "Alice"}
	if err := gdb.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	token := signTestToken(t, jwt.MapClaims{"username": "alice", "role": "clan"})

	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("db", gdb); c.Next() })
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.Use(LoadUserMiddleware())
	r.GET("/ok", func(c *gin.Context) {
		role, _ := c.Get("role")
		c.JSON(http.StatusOK, gin.H{"role": role})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["role"] != "admin" {
		t.Fatalf("role=%v want admin from DB", body["role"])
	}
}

func TestAuthMiddleware_InvalidUsernameClaims(t *testing.T) {
	cases := []struct {
		name   string
		claims jwt.MapClaims
	}{
		{"missing", jwt.MapClaims{"role": "clan"}},
		{"empty", jwt.MapClaims{"username": "", "role": "clan"}},
		{"whitespace", jwt.MapClaims{"username": "   ", "role": "clan"}},
		{"null", jwt.MapClaims{"username": nil, "role": "clan"}},
		{"number", jwt.MapClaims{"username": 42.0, "role": "clan"}},
		{"array", jwt.MapClaims{"username": []any{}, "role": "clan"}},
		{"object", jwt.MapClaims{"username": map[string]any{}, "role": "clan"}},
		{"too_short", jwt.MapClaims{"username": "a", "role": "clan"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			token := signTestToken(t, tc.claims)
			var loadUserReached atomic.Int64
			var handlerCalls atomic.Int64

			gdb := testMiddlewareDB(t)
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("db", gdb); c.Next() })
			r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
			r.Use(func(c *gin.Context) {
				loadUserReached.Add(1)
				c.Next()
			})
			r.Use(LoadUserMiddleware())
			r.GET("/ok", func(c *gin.Context) {
				handlerCalls.Add(1)
				c.Status(http.StatusOK)
			})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/ok", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			r.ServeHTTP(w, req)

			if w.Code != http.StatusUnauthorized {
				t.Fatalf("status %d body=%s", w.Code, w.Body.String())
			}
			if loadUserReached.Load() != 0 {
				t.Fatalf("LoadUser chain ran: count=%d", loadUserReached.Load())
			}
			if handlerCalls.Load() != 0 {
				t.Fatalf("handler ran: %d", handlerCalls.Load())
			}
		})
	}
}

func TestAuthMiddleware_ValidUsernameWhitespaceNormalized(t *testing.T) {
	gdb := testMiddlewareDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	u := models.Korisnik{Username: "alice", Password: string(hash), Role: "clan", FullName: "Alice"}
	if err := gdb.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	token := signTestToken(t, jwt.MapClaims{"username": "  Alice  ", "role": "clan"})

	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("db", gdb); c.Next() })
	r.Use(AuthMiddleware([]byte(testMiddlewareJWTSecret)))
	r.Use(LoadUserMiddleware())
	r.GET("/ok", func(c *gin.Context) {
		if c.GetString("username") != "alice" {
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

func TestAuthMiddleware_ExpiredAndTamperedStillRejected(t *testing.T) {
	expired := signTestToken(t, jwt.MapClaims{
		"username": "alice",
		"role":     "clan",
		"exp":      time.Now().Add(-time.Hour).Unix(),
	})
	status, called := runAuthProtected(t, "Bearer "+expired)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("expired: status=%d called=%v", status, called)
	}

	valid := signTestToken(t, jwt.MapClaims{"username": "alice", "role": "clan"})
	tampered := valid[:len(valid)-2] + "xx"
	status, called = runAuthProtected(t, "Bearer "+tampered)
	if status != http.StatusUnauthorized || called {
		t.Fatalf("tampered: status=%d called=%v", status, called)
	}
}
