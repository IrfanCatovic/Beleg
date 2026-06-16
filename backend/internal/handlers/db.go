package handlers

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DB vraća GORM instancu iz Gin konteksta (postavlja app middleware).
func DB(c *gin.Context) *gorm.DB {
	return c.MustGet("db").(*gorm.DB)
}
