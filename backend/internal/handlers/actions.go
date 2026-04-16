package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/middleware"
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

var allowedTezine = map[string]bool{"lako": true, "srednje": true, "tesko": true, "alpinizam": true}

func isValidTezina(tezina string) bool {
	return allowedTezine[strings.TrimSpace(strings.ToLower(tezina))]
}

func GetPublicAkcijaByID(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
			return
		}
		dbAny, _ := c.Get("db")
		db := dbAny.(*gorm.DB)
		var akcija models.Akcija
		if err := db.First(&akcija, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Akcija nije pronađena"})
			return
		}

		canSeePrivateDetails := akcija.Javna
		if !akcija.Javna && akcija.KlubID != nil {
			tokenStr := middleware.GetTokenFromRequest(c)
			if tokenStr != "" {
				claims := jwt.MapClaims{}
				if token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
					if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, jwt.ErrSignatureInvalid
					}
					return jwtSecret, nil
				}); err == nil && token.Valid {
					usernameClaim, _ := claims["username"].(string)
					roleClaim, _ := claims["role"].(string)
					usernameClaim = strings.TrimSpace(usernameClaim)
					if usernameClaim != "" {
						var viewer models.Korisnik
						if err := helpers.DBWhereUsername(db, usernameClaim).First(&viewer).Error; err == nil {
							if viewer.KlubID != nil && *viewer.KlubID == *akcija.KlubID {
								canSeePrivateDetails = true
							}
							if roleClaim == "superadmin" {
								if selectedClubID, err := strconv.ParseUint(strings.TrimSpace(c.GetHeader("X-Club-Id")), 10, 64); err == nil && uint(selectedClubID) == *akcija.KlubID {
									canSeePrivateDetails = true
								}
							}
						}
					}
				}
			}
		}

		if !canSeePrivateDetails {
			limited := gin.H{
				"id":          akcija.ID,
				"naziv":       akcija.Naziv,
				"planina":     akcija.Planina,
				"vrh":         akcija.Vrh,
				"datum":       akcija.Datum,
				"isCompleted": akcija.IsCompleted,
				"createdAt":   akcija.CreatedAt,
				"updatedAt":   akcija.UpdatedAt,
				"javna":       akcija.Javna,
				"limited":     true,
			}
			if akcija.KlubID != nil {
				limited["klubId"] = *akcija.KlubID
			}
			c.JSON(200, limited)
			return
		}

		resp := gin.H{
			"id": akcija.ID, "naziv": akcija.Naziv, "planina": akcija.Planina, "vrh": akcija.Vrh, "datum": akcija.Datum,
			"opis": akcija.Opis, "tezina": akcija.Tezina, "slikaUrl": akcija.SlikaURL,
			"createdAt": akcija.CreatedAt, "updatedAt": akcija.UpdatedAt,
			"isCompleted": akcija.IsCompleted, "kumulativniUsponM": akcija.UkupnoMetaraUsponaAkcija,
			"duzinaStazeKm": akcija.UkupnoKmAkcija, "visinaVrhM": akcija.VisinaVrhM, "zimskiUspon": akcija.ZimskiUspon,
			"vodicId":       akcija.VodicID,
			"drugiVodicIme": akcija.DrugiVodicIme, "addedById": akcija.AddedByID,
			"javna": akcija.Javna,
		}
		if akcija.KlubID != nil {
			resp["klubId"] = *akcija.KlubID
		}
		if akcija.Javna && akcija.KlubID != nil {
			var klub models.Klubovi
			if db.First(&klub, *akcija.KlubID).Error == nil {
				resp["klubNaziv"] = klub.Naziv
			}
		}
		if akcija.VodicID > 0 {
			var v models.Korisnik
			if db.First(&v, akcija.VodicID).Error == nil {
				resp["vodic"] = gin.H{"fullName": v.FullName, "username": v.Username}
			}
		}
		if akcija.AddedByID > 0 {
			var a models.Korisnik
			if db.First(&a, akcija.AddedByID).Error == nil {
				resp["addedBy"] = gin.H{"fullName": a.FullName, "username": a.Username}
			}
		}
		var prijaveCount int64
		db.Model(&models.Prijava{}).Where("akcija_id = ?", id).Count(&prijaveCount)
		resp["prijaveCount"] = prijaveCount
		c.JSON(200, resp)
	}
}

func GetAkcije(c *gin.Context) {
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	gormDb := dbAny.(*gorm.DB)

	clubID, ok := helpers.GetEffectiveClubID(c, gormDb)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi.", "aktivne": []models.Akcija{}, "zavrsene": []models.Akcija{}})
		return
	}
	if clubID == 0 {
		c.JSON(http.StatusOK, gin.H{"aktivne": []models.Akcija{}, "zavrsene": []models.Akcija{}})
		return
	}

	if strings.EqualFold(strings.TrimSpace(c.Query("scope")), "global") {
		var aktivne []models.Akcija
		where := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND javna = ?"
		if err := gormDb.Preload("Klub").Where(where, false, true, true).Find(&aktivne).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
			return
		}
		for i := range aktivne {
			if aktivne[i].Klub != nil {
				aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
			}
		}
		c.JSON(http.StatusOK, gin.H{"aktivne": aktivne, "zavrsene": []models.Akcija{}})
		return
	}

	var aktivne []models.Akcija
	var zavrsene []models.Akcija
	aktivneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND (klub_id = ? OR javna = ?)"
	if err := gormDb.Preload("Klub").Where(aktivneWhere, false, true, clubID, true).Find(&aktivne).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
		return
	}
	zavrseneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND klub_id = ?"
	if err := gormDb.Preload("Klub").Where(zavrseneWhere, true, true, clubID).Find(&zavrsene).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju završenih akcija"})
		return
	}
	for i := range aktivne {
		if aktivne[i].Klub != nil {
			aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
		}
	}
	for i := range zavrsene {
		if zavrsene[i].Klub != nil {
			zavrsene[i].KlubNaziv = zavrsene[i].Klub.Naziv
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"aktivne":  aktivne,
		"zavrsene": zavrsene,
	})
}

func CreateAkcija(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič mogu dodavati akcije"})
		return
	}
	username, _ := c.Get("username")
	db := c.MustGet("db").(*gorm.DB)
	var currentUser models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&currentUser).Error; err != nil {
		c.JSON(500, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok || clubID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (superadmin) ili niste u klubu."})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeća forma"})
		return
	}

	naziv := c.PostForm("naziv")
	planina := strings.TrimSpace(c.PostForm("planina"))
	vrh := c.PostForm("vrh")
	datumStr := c.PostForm("datum")
	opis := c.PostForm("opis")
	tezina := c.PostForm("tezina")
	kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
	duzinaStazeKmStr := c.PostForm("duzinaStazeKm")
	visinaVrhMStr := c.PostForm("visinaVrhM")
	zimskiUsponStr := c.PostForm("zimskiUspon")
	vodicIDStr := c.PostForm("vodic_id")
	drugiVodicIme := c.PostForm("drugi_vodic_ime")
	javna := strings.ToLower(strings.TrimSpace(c.PostForm("javna"))) == "true"

	if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
		c.JSON(400, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
		return
	}
	if !isValidTezina(tezina) {
		c.JSON(400, gin.H{"error": "Izaberi težinu od ponuđenih"})
		return
	}

	datum, err := time.Parse("2006-01-02", datumStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Datum mora biti YYYY-MM-DD"})
		return
	}

	kumulativniUsponM, err := strconv.Atoi(kumulativniUsponMStr)
	if err != nil || kumulativniUsponM < 0 {
		c.JSON(400, gin.H{"error": "Kumulativni uspon mora biti ceo pozitivan broj (metri)"})
		return
	}

	duzinaStazeKm, err := strconv.ParseFloat(duzinaStazeKmStr, 64)
	if err != nil || duzinaStazeKm < 0 {
		c.JSON(400, gin.H{"error": "Dužina staze mora biti pozitivan broj (km)"})
		return
	}

	var visinaVrhM int
	if strings.TrimSpace(visinaVrhMStr) != "" {
		visinaVrhM, err = strconv.Atoi(visinaVrhMStr)
		if err != nil || visinaVrhM < 0 {
			c.JSON(400, gin.H{"error": "Visina vrha mora biti ceo pozitivan broj (metri)"})
			return
		}
	}

	zimskiUspon := strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"

	var vodicID uint
	if vodicIDStr != "" {
		if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
			vodicID = uint(vID)
		}
	}

	akcija := models.Akcija{
		Naziv:                    naziv,
		Planina:                  planina,
		Vrh:                      vrh,
		Datum:                    datum,
		Opis:                     opis,
		Tezina:                   tezina,
		UkupnoMetaraUsponaAkcija: kumulativniUsponM,
		UkupnoKmAkcija:           duzinaStazeKm,
		VisinaVrhM:               visinaVrhM,
		ZimskiUspon:              zimskiUspon,
		SlikaURL:                 "",
		IsCompleted:              false,
		UIstorijiKluba:           true,
		Javna:                    javna,
		KlubID:                   &clubID,
		VodicID:                  vodicID,
		DrugiVodicIme:            strings.TrimSpace(drugiVodicIme),
		AddedByID:                currentUser.ID,
	}

	if err := db.Create(&akcija).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri čuvanju akcije"})
		return
	}

	var notifyUserIDs []uint
	if javna {
		db.Model(&models.Korisnik{}).Where("klub_id IS NOT NULL").Pluck("id", &notifyUserIDs)
	} else {
		db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Pluck("id", &notifyUserIDs)
	}
	notifications.NotifyUsers(db, notifyUserIDs, models.ObavestenjeTipAkcija, "Nova akcija u kalendaru", akcija.Naziv, "/akcije/"+strconv.Itoa(int(akcija.ID)), fmt.Sprintf(`{"akcijaId":%d}`, akcija.ID))

	files := form.File["slika"]
	if len(files) > 0 {
		file := files[0]
		if err := helpers.ValidateImageFileHeader(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna slika akcije: " + err.Error()})
			return
		}
		clubIDForFolder := uint(0)
		if akcija.KlubID != nil {
			clubIDForFolder = *akcija.KlubID
		}
		if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		f, err := file.Open()
		if err != nil {
			c.JSON(500, gin.H{"error": "Greška pri čitanju fajla"})
			return
		}
		defer f.Close()

		cld, err := cloudinary.NewFromParams(
			os.Getenv("CLOUDINARY_CLOUD_NAME"),
			os.Getenv("CLOUDINARY_API_KEY"),
			os.Getenv("CLOUDINARY_API_SECRET"),
		)
		if err != nil {
			c.JSON(500, gin.H{"error": "Greška pri inicijalizaciji Cloudinary-ja"})
			return
		}

		ctx := context.Background()
		uploadParams := uploader.UploadParams{
			PublicID:       fmt.Sprintf("akcije/%d", akcija.ID),
			Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
			Transformation: "q_auto:good,f_auto",
		}

		uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
		if err != nil {
			c.JSON(500, gin.H{"error": "Greška pri upload-u na Cloudinary: " + err.Error()})
			return
		}
		helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
		akcija.SlikaURL = uploadResult.SecureURL
		db.Save(&akcija)
	}

	c.JSON(201, gin.H{
		"message": "Akcija dodata",
		"akcija":  akcija,
	})
}

func UpdateAkcija(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može izmeniti akciju"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je menja"})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća forma"})
		return
	}

	naziv := c.PostForm("naziv")
	planina := strings.TrimSpace(c.PostForm("planina"))
	vrh := c.PostForm("vrh")
	datumStr := c.PostForm("datum")
	opis := c.PostForm("opis")
	tezina := c.PostForm("tezina")
	kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
	duzinaStazeKmStr := c.PostForm("duzinaStazeKm")
	visinaVrhMStr := c.PostForm("visinaVrhM")
	zimskiUsponStr := c.PostForm("zimskiUspon")
	vodicIDStr := c.PostForm("vodic_id")
	drugiVodicIme := c.PostForm("drugi_vodic_ime")
	if rawJavna := c.PostForm("javna"); rawJavna != "" {
		akcija.Javna = strings.ToLower(strings.TrimSpace(rawJavna)) == "true"
	}

	if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
		return
	}
	if !isValidTezina(tezina) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberi težinu od ponuđenih"})
		return
	}

	datum, err := time.Parse("2006-01-02", datumStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datum mora biti YYYY-MM-DD"})
		return
	}

	kumulativniUsponM, err := strconv.Atoi(kumulativniUsponMStr)
	if err != nil || kumulativniUsponM < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kumulativni uspon mora biti ceo pozitivan broj (metri)"})
		return
	}

	duzinaStazeKm, err := strconv.ParseFloat(duzinaStazeKmStr, 64)
	if err != nil || duzinaStazeKm < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dužina staze mora biti pozitivan broj (km)"})
		return
	}

	if strings.TrimSpace(visinaVrhMStr) != "" {
		visinaVrhM, err := strconv.Atoi(visinaVrhMStr)
		if err != nil || visinaVrhM < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Visina vrha mora biti ceo pozitivan broj (metri)"})
			return
		}
		akcija.VisinaVrhM = visinaVrhM
	}

	if strings.TrimSpace(zimskiUsponStr) != "" {
		akcija.ZimskiUspon = strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"
	}

	var vodicID uint
	if vodicIDStr != "" {
		if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
			vodicID = uint(vID)
		}
	}

	akcija.Naziv = naziv
	akcija.Planina = planina
	akcija.Vrh = vrh
	akcija.Datum = datum
	akcija.Opis = opis
	akcija.Tezina = tezina
	akcija.UkupnoMetaraUsponaAkcija = kumulativniUsponM
	akcija.UkupnoKmAkcija = duzinaStazeKm
	akcija.VodicID = vodicID
	akcija.DrugiVodicIme = strings.TrimSpace(drugiVodicIme)

	if err := db.Save(&akcija).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju akcije"})
		return
	}

	files := form.File["slika"]
	if len(files) > 0 {
		file := files[0]
		if err := helpers.ValidateImageFileHeader(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Neispravna slika akcije: " + err.Error()})
			return
		}
		clubIDForFolder := uint(0)
		if akcija.KlubID != nil {
			clubIDForFolder = *akcija.KlubID
		}
		if err := helpers.CheckStorageLimit(db, clubIDForFolder, file.Size); err != nil {
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
			PublicID:       fmt.Sprintf("akcije/%d", akcija.ID),
			Folder:         helpers.CloudinaryFolderForClub(clubIDForFolder),
			Transformation: "q_auto:good,f_auto",
		}

		uploadResult, err := cld.Upload.Upload(ctx, f, uploadParams)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri upload-u na Cloudinary: " + err.Error()})
			return
		}
		helpers.AddStorageUsage(db, clubIDForFolder, file.Size)
		helpers.ScheduleCloudinaryDeletion(db, os.Getenv("CLOUDINARY_CLOUD_NAME"), akcija.SlikaURL)
		akcija.SlikaURL = uploadResult.SecureURL
		db.Save(&akcija)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Akcija uspešno ažurirana",
		"akcija":  akcija,
	})
}

func PrijaviNaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var count int64
	db.Model(&models.Prijava{}).
		Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).
		Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Već ste prijavljeni za ovu akciju"})
		return
	}

	prijava := models.Prijava{
		AkcijaID:   uint(akcijaID),
		KorisnikID: korisnik.ID,
	}
	if err := db.Create(&prijava).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri prijavi", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Uspešno ste se prijavili!",
		"akcijaId":     akcijaID,
		"prijavljenAt": prijava.PrijavljenAt,
	})
}

func GetMojaPrijavaZaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
		return
	}
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	var prijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcijaID, korisnik.ID).First(&prijava).Error; err != nil {
		c.JSON(200, gin.H{"prijava": nil})
		return
	}
	c.JSON(200, gin.H{
		"prijava": gin.H{
			"id":           prijava.ID,
			"status":       prijava.Status,
			"prijavljenAt": prijava.PrijavljenAt,
		},
	})
}

func GetPrijaveZaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var akcijaZaPravo models.Akcija
	if err := db.First(&akcijaZaPravo, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	canSeePrijave := false
	if akcijaZaPravo.Javna {
		canSeePrijave = true
	} else if akcijaZaPravo.KlubID != nil {
		if viewerClubID, ok := helpers.GetEffectiveClubID(c, db); ok && viewerClubID == *akcijaZaPravo.KlubID {
			canSeePrijave = true
		}
	}
	if !canSeePrijave {
		c.JSON(http.StatusForbidden, gin.H{"error": "Spisak prijavljenih nije dostupan za ovu akciju"})
		return
	}

	var prijave []models.Prijava
	if err := db.Preload("Korisnik").Where("akcija_id = ?", id).Find(&prijave).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri čitanju prijava"})
		return
	}

	type PrijavaDTO struct {
		ID           uint      `json:"id"`
		Korisnik     string    `json:"korisnik"`
		FullName     string    `json:"fullName"`
		AvatarURL    string    `json:"avatarUrl,omitempty"`
		PrijavljenAt time.Time `json:"prijavljenAt"`
		Status       string    `json:"status"`
	}

	var out []PrijavaDTO
	for _, p := range prijave {
		fullName := ""
		avatarURL := ""
		if p.Korisnik.ID != 0 {
			fullName = p.Korisnik.FullName
			avatarURL = p.Korisnik.AvatarURL
		}
		out = append(out, PrijavaDTO{
			ID:           p.ID,
			Korisnik:     p.Korisnik.Username,
			FullName:     fullName,
			AvatarURL:    avatarURL,
			PrijavljenAt: p.PrijavljenAt,
			Status:       p.Status,
		})
	}

	c.JSON(200, gin.H{"prijave": out})
}

func DodajClanaPopeoSe(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može dodati člana na završenu akciju"})
		return
	}

	idStr := c.Param("id")
	akcijaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	var req struct {
		KorisnikID uint `json:"korisnikId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.KorisnikID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći korisnikId"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, akcijaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da dodaje članove na ovu akciju"})
		return
	}
	if !akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Član se ovde može dodati tek kada je akcija završena"})
		return
	}

	var korisnik models.Korisnik
	if err := db.First(&korisnik, req.KorisnikID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if korisnik.Role == "deleted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Korisnik je deaktiviran"})
		return
	}
	if akcija.KlubID == nil || korisnik.KlubID == nil || *korisnik.KlubID != *akcija.KlubID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Možete dodati samo člana kluba koji je domaćin akcije"})
		return
	}

	var prijava models.Prijava
	err = db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, korisnik.ID).First(&prijava).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijave"})
		return
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		prijava = models.Prijava{
			AkcijaID:   akcija.ID,
			KorisnikID: korisnik.ID,
			Status:     "popeo se",
		}
		if err := db.Create(&prijava).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri dodavanju člana na akciju"})
			return
		}
	} else {
		if prijava.Status == "popeo se" {
			c.JSON(http.StatusConflict, gin.H{"error": "Član je već označen kao uspešno popeo se"})
			return
		}
		prijava.Status = "popeo se"
		if err := db.Save(&prijava).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju prijave"})
			return
		}
	}

	korisnik.UkupnoKmKorisnik += akcija.UkupnoKmAkcija
	korisnik.UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
	korisnik.BrojPopeoSe += 1
	if err := db.Save(&korisnik).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Član je dodat na završenu akciju kao uspešno popeo se",
		"prijava": prijava,
	})
}

func ZavrsiAkciju(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može završiti akciju"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je završi"})
		return
	}

	if akcija.IsCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akcija je već završena"})
		return
	}

	akcija.IsCompleted = true
	if err := db.Save(&akcija).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri ažuriranju akcije"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Akcija uspešno završena", "akcija": akcija})
}

func DeleteAkcija(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može obrisati akciju"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je obriše"})
		return
	}

	if err := db.Where("akcija_id = ?", id).Delete(&models.Prijava{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju prijava"})
		return
	}
	if err := db.Delete(&akcija).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju akcije"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Akcija uspešno obrisana"})
}

func OtkaziPrijavuNaAkciju(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID akcije"})
		return
	}

	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)

	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var prijava models.Prijava
	if err := db.Where("akcija_id = ? AND korisnik_id = ?", id, korisnik.ID).First(&prijava).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Niste bili prijavljeni na ovu akciju"})
		return
	}
	if prijava.Status != "prijavljen" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Ne možete otkazati prijavu nakon što vam je admin potvrdio uspeh ili neuspeh"})
		return
	}
	if err := db.Delete(&prijava).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri otkazivanju"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Uspešno ste otkazali prijavu"})
}

func GetMojePopeoSe(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Korisnik nije pronađen", "details": err.Error()})
		return
	}

	var prijave []models.Prijava
	err := db.Where("korisnik_id = ? AND status = ?", korisnik.ID, "popeo se").Preload("Akcija").Find(&prijave).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju prijava", "details": err.Error()})
		return
	}

	var uspesneAkcije []models.Akcija
	var ukupnoKm float64
	var ukupnoMetaraUspona int
	var brojPopeoSe int
	for _, p := range prijave {
		if p.Akcija.ID != 0 {
			uspesneAkcije = append(uspesneAkcije, p.Akcija)
			ukupnoKm += p.Akcija.UkupnoKmAkcija
			ukupnoMetaraUspona += p.Akcija.UkupnoMetaraUsponaAkcija
			brojPopeoSe++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"uspesneAkcije": uspesneAkcije,
		"statistika": map[string]interface{}{
			"ukupnoKm":           ukupnoKm,
			"ukupnoMetaraUspona": ukupnoMetaraUspona,
			"brojPopeoSe":        brojPopeoSe,
		},
	})
}

func UpdatePrijavaStatus(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič može menjati status"})
		return
	}

	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći status"})
		return
	}

	log.Printf("Primljen status (raw): '%q'", req.Status)
	log.Printf("Dužina stringa: %d", len(req.Status))

	validStatuses := map[string]bool{"prijavljen": true, "popeo se": true, "nije uspeo": true, "otkazano": true}
	if !validStatuses[req.Status] {
		c.JSON(400, gin.H{"error": "Nevažeći status"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var prijava models.Prijava
	if err := db.Preload("Akcija").First(&prijava, prijavaID).Error; err != nil {
		c.JSON(404, gin.H{"error": "Prijava nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, prijava.Akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da menja status prijava"})
		return
	}

	if req.Status == "popeo se" && prijava.Status != "popeo se" {
		var korisnik models.Korisnik
		if err := db.First(&korisnik, prijava.KorisnikID).Error; err != nil {
			c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
		korisnik.UkupnoKmKorisnik += prijava.Akcija.UkupnoKmAkcija
		korisnik.UkupnoMetaraUsponaKorisnik += prijava.Akcija.UkupnoMetaraUsponaAkcija
		korisnik.BrojPopeoSe += 1
		if err := db.Save(&korisnik).Error; err != nil {
			c.JSON(500, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
			return
		}
	}

	prijava.Status = req.Status
	if err := db.Save(&prijava).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri ažuriranju statusa"})
		return
	}
	c.JSON(200, gin.H{"message": "Status ažuriran", "prijava": prijava})
}

func DeletePrijava(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič može da ukloni člana sa akcije"})
		return
	}

	idStr := c.Param("id")
	prijavaID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID prijave"})
		return
	}

	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var prijava models.Prijava
	if err := db.Preload("Akcija").First(&prijava, prijavaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prijava nije pronađena"})
		return
	}
	if !helpers.CanManageAkcija(c, db, prijava.Akcija.KlubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo organizator kluba domaćina može da ukloni člana sa akcije"})
		return
	}

	if prijava.Status == "popeo se" {
		var korisnik models.Korisnik
		if err := db.First(&korisnik, prijava.KorisnikID).Error; err == nil {
			korisnik.UkupnoKmKorisnik -= prijava.Akcija.UkupnoKmAkcija
			korisnik.UkupnoMetaraUsponaKorisnik -= prijava.Akcija.UkupnoMetaraUsponaAkcija
			korisnik.BrojPopeoSe -= 1
			if korisnik.UkupnoKmKorisnik < 0 {
				korisnik.UkupnoKmKorisnik = 0
			}
			if korisnik.UkupnoMetaraUsponaKorisnik < 0 {
				korisnik.UkupnoMetaraUsponaKorisnik = 0
			}
			if korisnik.BrojPopeoSe < 0 {
				korisnik.BrojPopeoSe = 0
			}
			db.Save(&korisnik)
		}
	}

	if err := db.Delete(&prijava).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri uklanjanju člana sa akcije"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Član je uklonjen sa akcije"})
}

func GetMojePrijave(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return
	}
	dbAny, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Baza nije dostupna"})
		return
	}
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	var prijavljene []uint
	db.Model(&models.Prijava{}).Where("korisnik_id = ?", korisnik.ID).Pluck("akcija_id", &prijavljene)
	var otkazive []uint
	db.Model(&models.Prijava{}).Where("korisnik_id = ? AND status = ?", korisnik.ID, "prijavljen").Pluck("akcija_id", &otkazive)

	c.JSON(http.StatusOK, gin.H{
		"prijavljeneAkcije": prijavljene,
		"otkaziveAkcije":    otkazive,
	})
}
