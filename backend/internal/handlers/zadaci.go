package handlers

import (
	"net/http"
	"strings"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)


type createZadatakRequest struct {
	Naziv        string   `json:"naziv" binding:"required"`
	Opis         string   `json:"opis"`
	Deadline     *string  `json:"deadline"`
	Hitno        bool     `json:"hitno"`
	AllowedRoles []string `json:"allowedRoles"`
	AllowAll     bool     `json:"allowAll"`
}


func checkZadatakCreateRole(c *gin.Context) bool {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	return role == "admin" || role == "sekretar"
}

func GetZadaci(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)


	var zadaci []models.Zadatak
	if err := db.Order("created_at DESC").Find(&zadaci).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju zadataka"})
		return
	}
	c.JSON(http.StatusOK, zadaci)
}


func CreateZadatak(c *gin.Context) {
	if !checkZadatakCreateRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar mogu da kreiraju zadatke"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var req createZadatakRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći zahtev (npr. nedostaje naziv)"})
		return
	}

	naziv := strings.TrimSpace(req.Naziv)
	if naziv == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv zadatka je obavezan"})
		return
	}
	if !req.AllowAll && len(req.AllowedRoles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite barem jednu ulogu ili opciju Svi"})
		return
	}

	var deadline *time.Time
	if req.Deadline != nil && strings.TrimSpace(*req.Deadline) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.Deadline))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Deadline mora biti u formatu YYYY-MM-DD"})
			return
		}
		deadline = &t
	}

	zadatak := models.Zadatak{
		Naziv:        naziv,
		Opis:         strings.TrimSpace(req.Opis),
		AllowedRoles: req.AllowedRoles,
		AllowAll:     req.AllowAll,
		Deadline:     deadline,
		Hitno:        req.Hitno,
	}
	if err := db.Create(&zadatak).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju zadatka"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"zadatak": zadatak})
}
