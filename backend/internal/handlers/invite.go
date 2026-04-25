package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type inviteValidateBody struct {
	Code string `json:"code"`
}

func canManageInviteCode(c *gin.Context, db *gorm.DB) (clubID uint, ok bool) {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "admin" && role != "sekretar" && role != "superadmin" {
		return 0, false
	}
	clubID, ok = helpers.GetEffectiveClubID(c, db)
	if !ok || clubID == 0 {
		return 0, false
	}
	if role != "superadmin" {
		usernameVal, _ := c.Get("username")
		username, _ := usernameVal.(string)
		var k models.Korisnik
		if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&k).Error; err != nil || k.KlubID == nil || *k.KlubID != clubID {
			return 0, false
		}
	}
	return clubID, true
}

func inviteAdminJSON(k *models.Klubovi, now time.Time) gin.H {
	var expiresAt interface{}
	if k.InviteExpiresAt != nil {
		expiresAt = k.InviteExpiresAt.UTC().Format(time.RFC3339)
	} else {
		expiresAt = nil
	}
	var lastReg interface{}
	if k.InviteLastRegeneratedAt != nil {
		lastReg = k.InviteLastRegeneratedAt.UTC().Format(time.RFC3339)
	} else {
		lastReg = nil
	}
	code := ""
	if k.InviteCode != nil {
		code = *k.InviteCode
	}
	return gin.H{
		"code":               code,
		"klubId":             k.ID,
		"expiresAt":          expiresAt,
		"lastRegeneratedAt":  lastReg,
		"regenAvailableInMs": helpers.RegenAvailableInMs(k.InviteLastRegeneratedAt, now),
	}
}

// ensureInviteCodeForKlub generiše kod ako nedostaje, čuva u bazi.
func ensureInviteCodeForKlub(db *gorm.DB, k *models.Klubovi, now time.Time) error {
	if k.InviteCode != nil && *k.InviteCode != "" {
		return nil
	}
	gen, err := helpers.GenerateUniqueInviteCode(db)
	if err != nil {
		return err
	}
	k.InviteCode = &gen
	k.InviteLastRegeneratedAt = &now
	exp := now.Add(helpers.InviteCodeTTL)
	k.InviteExpiresAt = &exp
	return db.Save(k).Error
}

// GetInviteCodeForAdmin GET /api/klub/invite-code
func GetInviteCodeForAdmin(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := canManageInviteCode(c, db)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar kluba mogu da vide invite kod"})
		return
	}
	var k models.Klubovi
	if err := db.First(&k, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}
	now := time.Now()
	if err := ensureInviteCodeForKlub(db, &k, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju koda"})
		return
	}
	if err := db.First(&k, clubID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju kluba"})
		return
	}
	rotated, err := helpers.AutoRotateExpiredInviteCode(db, &k, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri osvežavanju isteklog koda"})
		return
	}
	if rotated {
		if err := db.First(&k, clubID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju kluba"})
			return
		}
	}
	c.JSON(http.StatusOK, inviteAdminJSON(&k, now))
}

// RegenerateInviteCode POST /api/klub/invite-code/regenerate
func RegenerateInviteCode(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := canManageInviteCode(c, db)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili sekretar kluba mogu da menjaju invite kod"})
		return
	}
	var k models.Klubovi
	if err := db.First(&k, clubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}
	now := time.Now()
	expired := helpers.InviteCodeExpired(&k, now)
	if ms := helpers.RegenAvailableInMs(k.InviteLastRegeneratedAt, now); ms > 0 && !expired {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":              "Novi kod možeš generisati tek posle isteka pauze.",
			"regenAvailableInMs": ms,
		})
		return
	}
	gen, err := helpers.GenerateUniqueInviteCode(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri generisanju koda"})
		return
	}
	// oslobodi stari kod za unique (isti klub može zadržati unique na novom)
	k.InviteCode = &gen
	k.InviteLastRegeneratedAt = &now
	exp := now.Add(helpers.InviteCodeTTL)
	k.InviteExpiresAt = &exp
	if err := db.Save(&k).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju kluba"})
		return
	}
	c.JSON(http.StatusOK, inviteAdminJSON(&k, now))
}

// ValidateInviteCode POST /api/invite-code/validate
func ValidateInviteCode(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	var body inviteValidateBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"valid": false, "error": "Nevažeći zahtev"})
		return
	}
	code := helpers.NormalizeInviteCode(body.Code)
	if len(code) != helpers.InviteCodeLength {
		c.JSON(http.StatusOK, gin.H{"valid": false, "error": "Nevažeći format koda"})
		return
	}
	var k models.Klubovi
	if err := db.Where("invite_code = ?", code).First(&k).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"valid": false, "error": "Kod nije pronađen"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"valid": false, "error": "Greška pri proveri"})
		return
	}
	now := time.Now()
	if !helpers.InviteCodeMatchesKlub(&k, code, now) {
		c.JSON(http.StatusOK, gin.H{"valid": false, "error": "Kod nije važeći ili je istekao"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"valid":     true,
		"klubId":    k.ID,
		"klubNaziv": k.Naziv,
	})
}

// RegisterInvite POST /api/register/invite — javna registracija kao član (multipart + inviteCode + klubId)
func RegisterInvite(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći format zahteva"})
		return
	}
	inviteCode := helpers.NormalizeInviteCode(c.PostForm("inviteCode"))
	if inviteCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno polje inviteCode"})
		return
	}
	klubIDStr := strings.TrimSpace(c.PostForm("klubId"))
	var klubID uint
	if klubIDStr != "" {
		id, err := strconv.ParseUint(klubIDStr, 10, 32)
		if err != nil || id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći klubId"})
			return
		}
		klubID = uint(id)
	}

	var k models.Klubovi
	if klubID != 0 {
		if err := db.First(&k, klubID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Klub nije pronađen"})
			return
		}
	} else {
		if err := db.Where("invite_code = ?", inviteCode).First(&k).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kod nije pronađen"})
			return
		}
	}

	now := time.Now()
	if !helpers.InviteCodeMatchesKlub(&k, inviteCode, now) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Kod nije važeći ili ne odgovara klubu"})
		return
	}
	if klubID != 0 && k.ID != klubID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Kod ne odgovara odabranom klubu"})
		return
	}

	username, usernameErr := helpers.ValidateUsername(c.PostForm("username"))
	password := c.PostForm("password")
	if usernameErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": usernameErr.Error()})
		return
	}
	if password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Obavezno polje: password"})
		return
	}
	if len(password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
		return
	}

	if err := helpers.CheckClubLimitsForRegister(db, k.ID, "clan"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri hash-ovanju lozinke"})
		return
	}

	post := func(keys ...string) string {
		for _, field := range keys {
			if v := strings.TrimSpace(c.PostForm(field)); v != "" {
				return v
			}
		}
		return ""
	}

	fullName := post("fullName", "full_name")
	imeRoditelja := post("imeRoditelja", "ime_roditelja")
	pol := post("pol")
	drzavljanstvo := post("drzavljanstvo")
	adresa := post("adresa")
	telefon := post("telefon")
	emailRaw := post("email")
	email := strings.TrimSpace(emailRaw)
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email je obavezan"})
		return
	}
	emailLower := strings.ToLower(email)
	if _, err := mail.ParseAddress(emailLower); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna email adresa"})
		return
	}
	if helpers.IsNonEmptyEmailTaken(db, emailLower, 0) {
		c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovom email adresom već postoji"})
		return
	}
	brojLicnogDokumenta := post("brojLicnogDokumenta", "broj_licnog_dokumenta")
	brojPlaninarskeLegitimacije := post("brojPlaninarskeLegitimacije", "broj_planinarske_legitimacije")
	brojPlaninarskeMarkice := post("brojPlaninarskeMarkice", "broj_planinarske_markice")
	izreceneDisciplinskeKazne := post("izreceneDisciplinskeKazne", "izrecene_disciplinske_kazne")
	izborUOrganeSportskogUdruzenja := post("izborUOrganeSportskogUdruzenja", "izbor_u_organe_sportskog_udruzenja")
	napomene := post("napomene")

	var datumRodjenja, datumUclanjenja *time.Time
	if s := post("datumRodjenja", "datum_rodjenja"); s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			datumRodjenja = &t
		}
	}
	if s := post("datumUclanjenja", "datum_uclanjenja"); s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			datumUclanjenja = &t
		}
	}

	clubID := k.ID
	avatarURL := ""
	if files := c.Request.MultipartForm.File["avatar"]; len(files) > 0 {
		file := files[0]
		if err := helpers.ValidateImageFileHeader(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna avatar slika: " + err.Error()})
			return
		}
		if err := helpers.CheckStorageLimit(db, clubID, file.Size); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		f, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju fajla"})
			return
		}
		defer f.Close()

		cld, err := cloudinary.NewFromParams(
			os.Getenv("CLOUDINARY_CLOUD_NAME"),
			os.Getenv("CLOUDINARY_API_KEY"),
			os.Getenv("CLOUDINARY_API_SECRET"),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri inicijalizaciji Cloudinary-ja"})
			return
		}
		ctx := context.Background()
		uploadParams := uploader.UploadParams{
			PublicID:       fmt.Sprintf("avatari/register-invite-%s-%d", username, time.Now().Unix()),
			Folder:         helpers.CloudinaryFolderForClub(clubID),
			Transformation: "q_auto:good,f_auto",
		}
		uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u slike: " + err.Error()})
			return
		}
		avatarURL = uploadResult.SecureURL
		_ = helpers.AddStorageUsage(db, clubID, file.Size)
	}

	klubIDPtr := &clubID
	korisnik := models.Korisnik{
		Username:                       username,
		Password:                       string(hashed),
		FullName:                       fullName,
		ImeRoditelja:                   imeRoditelja,
		Pol:                            pol,
		DatumRodjenja:                  datumRodjenja,
		Drzavljanstvo:                  drzavljanstvo,
		Adresa:                         adresa,
		Telefon:                        telefon,
		Email:                          emailLower,
		BrojLicnogDokumenta:            brojLicnogDokumenta,
		BrojPlaninarskeLegitimacije:    brojPlaninarskeLegitimacije,
		BrojPlaninarskeMarkice:         brojPlaninarskeMarkice,
		DatumUclanjenja:                datumUclanjenja,
		IzreceneDisciplinskeKazne:      izreceneDisciplinskeKazne,
		IzborUOrganeSportskogUdruzenja: izborUOrganeSportskogUdruzenja,
		Napomene:                       napomene,
		AvatarURL:                      avatarURL,
		Role:                           "clan",
		KlubID:                         klubIDPtr,
	}

	var takenMember models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&takenMember).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
		return
	}
	if err := db.Create(&korisnik).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Korisnik sa ovim username već postoji"})
		return
	}
	rawToken, tokenErr := createEmailVerificationToken(db, korisnik.ID)
	if tokenErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri kreiranju verifikacionog tokena"})
		return
	}
	if err := sendVerificationEmail(korisnik.Email, rawToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Slanje verifikacionog emaila nije uspelo"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Poslali smo link za potvrdu na email adresu. Potvrdite email pre prijave.",
		"email":   korisnik.Email,
	})
}
