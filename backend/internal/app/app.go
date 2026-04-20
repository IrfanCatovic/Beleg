package app

import (
	"beleg-app/backend/internal/config"
	"beleg-app/backend/internal/jobs"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/seed"
	"beleg-app/backend/middleware"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

type RouteRegistrar func(r *gin.Engine, db *gorm.DB, jwtSecret []byte)

// Run starts the HTTP app with production-style bootstrapping.
func Run(registerRoutes RouteRegistrar) {
	loadEnv()

	router := gin.Default()
	configureHTTPMiddleware(router)

	jwtSecret := mustJWTSecret()
	db := mustOpenDatabase()
	migrateAndSeed(db)
	injectDatabase(router, db)

	registerRoutes(router, db, jwtSecret)

	router.Static("/uploads", "./uploads")
	go jobs.RunCloudinaryPendingDeletesJob(db)
	mustRunServer(router)
}

func loadEnv() {
	if err := godotenv.Load(); err != nil {
		log.Println("GREŠKA: .env fajl NIJE UČITAN! Razlog:", err)
		return
	}
	log.Println("OK: .env fajl je učitan")
}

func configureHTTPMiddleware(r *gin.Engine) {
	origins := config.BuildAllowedOrigins()
	r.Use(middleware.SecurityHeaders(os.Getenv("SECURITY_CSP")))
	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Club-Id"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
}

func mustJWTSecret() []byte {
	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET nije podešen ili je prekratak (minimum 32 karaktera)")
	}
	return jwtSecret
}

func mustOpenDatabase() *gorm.DB {
	dsn := config.BuildDatabaseDSN()
	db, err := config.OpenDatabase(dsn)
	if err != nil {
		log.Fatal("Ne mogu da se povežem sa bazom:", err)
	}
	log.Println("Uspješno povezan sa bazom!")
	return db
}

func migrateAndSeed(db *gorm.DB) {
	err := db.AutoMigrate(
		&models.Akcija{},
		&models.AkcijaSmestaj{},
		&models.AkcijaOprema{},
		&models.AkcijaOpremaRent{},
		&models.AkcijaPrevoz{},
		&models.Prijava{},
		&models.PrijavaIzbori{},
		&models.Korisnik{},
		&models.Transakcija{},
		&models.Zadatak{},
		&models.ZadatakKorisnik{},
		&models.Obavestenje{},
		&models.Klubovi{},
		&models.ClubJoinRequest{},
		&models.ClubJoinBlock{},
		&models.ActionInviteLink{},
		&models.EmailVerificationToken{},
		&models.CloudinaryPendingDelete{},
		&models.Follow{},
		&models.Block{},
		&models.Post{},
		&models.PostLike{},
		&models.PostComment{},
	)
	if err != nil {
		log.Fatal("Greška pri automigraciji tabela:", err)
	}

	log.Println("Tabele su migrirane (akcije, prijave, korisnici, transakcije, zadaci, zadatak_korisnici, obavestenja, klubovi)")
	seed.RunIfEmpty(db)
}

func injectDatabase(r *gin.Engine, db *gorm.DB) {
	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	})
}

func mustRunServer(r *gin.Engine) {
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Neuspešno pokretanje servera:", err)
	}
}
