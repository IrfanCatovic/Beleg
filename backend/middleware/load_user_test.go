package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func testMiddlewareDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Korisnik{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestLoadUserMiddleware_SetsContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testMiddlewareDB(t)
	klubID := uint(5)
	u := models.Korisnik{Username: "tester", Role: "clan", KlubID: &klubID}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set("username", "tester")
		c.Next()
	})
	r.Use(LoadUserMiddleware())
	r.GET("/ok", func(c *gin.Context) {
		if _, ok := c.Get(ContextKeyKorisnik); !ok {
			c.Status(http.StatusInternalServerError)
			return
		}
		if id, _ := c.Get(ContextKeyUserID); id.(uint) != u.ID {
			c.Status(http.StatusInternalServerError)
			return
		}
		if kid, _ := c.Get(ContextKeyKlubID); kid.(uint) != klubID {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", w.Code)
	}
}

func TestLoadUserMiddleware_DeletedUser401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testMiddlewareDB(t)
	u := models.Korisnik{Username: "gone", Role: "deleted"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set("username", "gone")
		c.Next()
	})
	r.Use(LoadUserMiddleware())
	r.GET("/ok", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status %d, want 401", w.Code)
	}
}
