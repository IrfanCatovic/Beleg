package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"beleg-app/backend/middleware"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		var viewer *models.Korisnik
		if !akcija.Javna {
			tokenStr := middleware.GetTokenFromRequest(c)
			roleClaim := ""
			if tokenStr != "" {
				claims := jwt.MapClaims{}
				if token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
					if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, jwt.ErrSignatureInvalid
					}
					return jwtSecret, nil
				}); err == nil && token.Valid {
					usernameClaim, _ := claims["username"].(string)
					roleClaim, _ = claims["role"].(string)
					usernameClaim = strings.TrimSpace(usernameClaim)
					if usernameClaim != "" {
						var viewerUser models.Korisnik
						if err := helpers.DBWhereUsername(db, usernameClaim).First(&viewerUser).Error; err == nil {
							viewer = &viewerUser
						}
					}
				}
			}

			hasInvite := hasValidActionInviteLink(db, akcija.ID, c.Query("inviteToken"))
			if akcija.KlubID != nil {
				if hasInvite {
					canSeePrivateDetails = true
				}
				if viewer != nil && viewer.KlubID != nil && *viewer.KlubID == *akcija.KlubID {
					canSeePrivateDetails = true
				}
				if viewer != nil && roleClaim == "superadmin" {
					if selectedClubID, err := strconv.ParseUint(strings.TrimSpace(c.GetHeader("X-Club-Id")), 10, 64); err == nil && uint(selectedClubID) == *akcija.KlubID {
						canSeePrivateDetails = true
					}
				}
			} else if viewer != nil && hasInvite {
				// Privatna vodička akcija: detalji su dostupni ulogovanom korisniku sa validnim linkom.
				canSeePrivateDetails = true
			}
			if viewer != nil && viewerCanAccessPrivateAkcija(db, &akcija, viewer) {
				canSeePrivateDetails = true
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
			"javna":                    akcija.Javna,
			"organizatorTip":           akcija.OrganizatorTip,
			"tipAkcije":                akcija.TipAkcije,
			"trajanjeSati":             akcija.TrajanjeSati,
			"rokPrijava":               akcija.RokPrijava,
			"maxLjudi":                 akcija.MaxLjudi,
			"mestoPolaska":             akcija.MestoPolaska,
			"kontaktTelefon":           akcija.KontaktTelefon,
			"brojDana":                 akcija.BrojDana,
			"cenaClan":                 akcija.CenaClan,
			"cenaOstali":               akcija.CenaOstali,
			"prikaziListuPrijavljenih": akcija.PrikaziListuPrijavljenih,
			"omoguciGrupniChat":        akcija.OmoguciGrupniChat,
		}
		if akcija.PlaninaLat != nil {
			resp["planinaLat"] = *akcija.PlaninaLat
		}
		if akcija.PlaninaLng != nil {
			resp["planinaLng"] = *akcija.PlaninaLng
		}
		if akcija.FerrataID != nil {
			resp["ferrataId"] = *akcija.FerrataID
		}
		resp["startAt"] = akcija.StartAt
		resp["endAt"] = akcija.EndAt
		if len(akcija.FerrataSnapshotJSON) > 0 {
			var snap any
			if json.Unmarshal(akcija.FerrataSnapshotJSON, &snap) == nil {
				resp["ferrataSnapshot"] = snap
			}
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
				resp["vodic"] = gin.H{
					"fullName":     v.FullName,
					"username":     v.Username,
					"isProfiGuide": helpers.KorisnikIsApprovedProfiGuide(db, v.ID),
				}
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

		var smestaj []models.AkcijaSmestaj
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&smestaj).Error
		var oprema []models.AkcijaOprema
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&oprema).Error
		var rent []models.AkcijaOpremaRent
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&rent).Error
		reservedByRentID, _ := loadReservedRentByAction(db, akcija.ID, nil)
		for i := range rent {
			remaining := rent[i].DostupnaKolicina - reservedByRentID[rent[i].ID]
			if remaining < 0 {
				remaining = 0
			}
			rent[i].DostupnaKolicina = remaining
		}
		var prevoz []models.AkcijaPrevoz
		_ = db.Where("akcija_id = ?", akcija.ID).Find(&prevoz).Error
		resp["smestaj"] = smestaj
		resp["oprema"] = oprema
		resp["opremaRent"] = rent
		resp["prevoz"] = prevoz

		if viewer != nil {
			isClan := false
			if akcija.KlubID != nil && viewer.KlubID != nil && *viewer.KlubID == *akcija.KlubID {
				isClan = true
			}
			resp["isClanKluba"] = isClan
			saldo := computeBaseCenaForUser(akcija, *viewer)
			var moja models.Prijava
			if err := db.Where("akcija_id = ? AND korisnik_id = ?", akcija.ID, viewer.ID).First(&moja).Error; err == nil {
				var izbor models.PrijavaIzbori
				if err := db.Where("prijava_id = ?", moja.ID).First(&izbor).Error; err == nil {
					var smestajIDs []uint
					var prevozIDs []uint
					var rentItems []prijavaRentItem
					_ = json.Unmarshal([]byte(izbor.SelectedSmestajIDs), &smestajIDs)
					_ = json.Unmarshal([]byte(izbor.SelectedPrevozIDs), &prevozIDs)
					_ = json.Unmarshal([]byte(izbor.SelectedRentItemsRaw), &rentItems)
					if len(smestajIDs) > 0 {
						var picked []models.AkcijaSmestaj
						if err := db.Where("akcija_id = ? AND id IN ?", akcija.ID, smestajIDs).Find(&picked).Error; err == nil {
							for _, row := range picked {
								saldo += row.CenaPoOsobiUkupno
							}
						}
					}
					if len(prevozIDs) > 0 {
						var picked []models.AkcijaPrevoz
						if err := db.Where("akcija_id = ? AND id IN ?", akcija.ID, prevozIDs).Find(&picked).Error; err == nil {
							for _, row := range picked {
								saldo += row.CenaPoOsobi
							}
						}
					}
					for _, item := range rentItems {
						if item.RentID == 0 || item.Kolicina <= 0 {
							continue
						}
						var row models.AkcijaOpremaRent
						if err := db.Where("akcija_id = ? AND id = ?", akcija.ID, item.RentID).First(&row).Error; err == nil {
							saldo += row.CenaPoSetu * float64(item.Kolicina)
						}
					}
				}
			}
			resp["mojSaldo"] = saldo
		}
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
		var aktivne []models.Akcija
		where := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND javna = ?"
		if err := gormDb.Preload("Klub").Where(where, false, true, true).Find(&aktivne).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
			return
		}
		for i := range aktivne {
			if aktivne[i].Klub != nil {
				aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
				aktivne[i].KlubLogoURL = aktivne[i].Klub.LogoURL
			}
		}
		resp := gin.H{"aktivne": aktivne, "zavrsene": []models.Akcija{}}
		appendGuideOwnedAkcije(gormDb, c, resp)
		appendMyPrivateAkcije(gormDb, c, resp)
		c.JSON(http.StatusOK, resp)
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
				aktivne[i].KlubLogoURL = aktivne[i].Klub.LogoURL
			}
		}
		resp := gin.H{"aktivne": aktivne, "zavrsene": []models.Akcija{}}
		appendGuideOwnedAkcije(gormDb, c, resp)
		appendMyPrivateAkcije(gormDb, c, resp)
		c.JSON(http.StatusOK, resp)
		return
	}

	var aktivne []models.Akcija
	var zavrsene []models.Akcija
	aktivneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND (klub_id = ? OR javna = ?) AND " + sqlClubOrganizedOnly
	if err := gormDb.Preload("Klub").Where(aktivneWhere, false, true, clubID, true).Find(&aktivne).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju aktivnih akcija"})
		return
	}
	zavrseneWhere := "is_completed = ? AND (u_istoriji_kluba IS NULL OR u_istoriji_kluba = ?) AND klub_id = ? AND " + sqlClubOrganizedOnly
	if err := gormDb.Preload("Klub").Where(zavrseneWhere, true, true, clubID).Find(&zavrsene).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju završenih akcija"})
		return
	}
	for i := range aktivne {
		if aktivne[i].Klub != nil {
			aktivne[i].KlubNaziv = aktivne[i].Klub.Naziv
			aktivne[i].KlubLogoURL = aktivne[i].Klub.LogoURL
		}
	}
	for i := range zavrsene {
		if zavrsene[i].Klub != nil {
			zavrsene[i].KlubNaziv = zavrsene[i].Klub.Naziv
			zavrsene[i].KlubLogoURL = zavrsene[i].Klub.LogoURL
		}
	}

	resp := gin.H{
		"aktivne":  aktivne,
		"zavrsene": zavrsene,
	}
	appendGuideOwnedAkcije(gormDb, c, resp)
	appendMyPrivateAkcije(gormDb, c, resp)
	c.JSON(http.StatusOK, resp)
}

func appendGuideOwnedAkcije(db *gorm.DB, c *gin.Context, resp gin.H) {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "vodic" && role != "admin" && role != "superadmin" {
		resp["vodeneAktivne"] = []models.Akcija{}
		resp["vodeneZavrsene"] = []models.Akcija{}
		return
	}
	username, _ := c.Get("username")
	var viewer models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&viewer).Error; err != nil {
		resp["vodeneAktivne"] = []models.Akcija{}
		resp["vodeneZavrsene"] = []models.Akcija{}
		return
	}
	guideBase := "organizator_tip = ? AND vodic_id = ?"
	var vodeneAktivne, vodeneZavrsene []models.Akcija
	_ = db.Where(guideBase+" AND is_completed = ?", "vodic", viewer.ID, false).Order("datum DESC").Find(&vodeneAktivne).Error
	_ = db.Where(guideBase+" AND is_completed = ?", "vodic", viewer.ID, true).Order("datum DESC").Find(&vodeneZavrsene).Error
	resp["vodeneAktivne"] = vodeneAktivne
	resp["vodeneZavrsene"] = vodeneZavrsene
}

func appendMyPrivateAkcije(db *gorm.DB, c *gin.Context, resp gin.H) {
	empty := []models.Akcija{}
	resp["mojePrivatneAktivne"] = empty
	resp["mojePrivatneZavrsene"] = empty

	usernameVal, ok := c.Get("username")
	if !ok {
		return
	}
	var viewer models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(usernameVal)).First(&viewer).Error; err != nil {
		return
	}

	var prijavaAkcijaIDs []uint
	db.Model(&models.Prijava{}).
		Where("korisnik_id = ? AND status <> ?", viewer.ID, "otkazano").
		Pluck("akcija_id", &prijavaAkcijaIDs)

	loadPrivate := func(completed bool) []models.Akcija {
		q := db.Where("javna = ? AND is_completed = ?", false, completed)
		if len(prijavaAkcijaIDs) > 0 {
			q = q.Where("vodic_id = ? OR id IN ?", viewer.ID, prijavaAkcijaIDs)
		} else {
			q = q.Where("vodic_id = ?", viewer.ID)
		}
		var rows []models.Akcija
		_ = q.Order("datum DESC").Find(&rows).Error
		return rows
	}

	resp["mojePrivatneAktivne"] = loadPrivate(false)
	resp["mojePrivatneZavrsene"] = loadPrivate(true)
}

func belgradeLoc() *time.Location {
	loc, err := time.LoadLocation("Europe/Belgrade")
	if err != nil {
		return time.UTC
	}
	return loc
}

func parseViaFerrataStartAt(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, errors.New("prazno")
	}
	loc := belgradeLoc()
	layouts := []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02 15:04:05"}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, raw, loc); err == nil {
			return t, nil
		}
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, nil
	}
	return time.Time{}, errors.New("nevažeće vreme")
}

func calendarDatumUTCFromBelgradeClock(t time.Time) time.Time {
	d := t.In(belgradeLoc())
	return time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
}

// parseRequiredPlaninaLatLng validira obavezne koordinate za planinarske akcije (mapa ili ručni unos).
func parseRequiredPlaninaLatLng(latStr, lngStr string) (lat, lng *float64, errMsg string) {
	ls := strings.TrimSpace(strings.Replace(latStr, ",", ".", 1))
	gs := strings.TrimSpace(strings.Replace(lngStr, ",", ".", 1))
	if ls == "" || gs == "" {
		return nil, nil, "Za planinarsku akciju obavezno je postaviti tačku na mapi ili unijeti koordinate (širina i dužina)."
	}
	la, e1 := strconv.ParseFloat(ls, 64)
	ln, e2 := strconv.ParseFloat(gs, 64)
	if e1 != nil || e2 != nil {
		return nil, nil, "Koordinate nisu ispravni brojevi."
	}
	if la < -90 || la > 90 || ln < -180 || ln > 180 {
		return nil, nil, "Koordinate su van dozvoljenog opsega (širina −90…90, dužina −180…180)."
	}
	return &la, &ln, ""
}

func ferrataLatLngPointers(ft *models.Ferrata) (lat, lng *float64) {
	if ft == nil || ft.Lat == nil || ft.Lng == nil {
		return nil, nil
	}
	la, ln := *ft.Lat, *ft.Lng
	return &la, &ln
}

func CreateAkcija(c *gin.Context) {
	username, _ := c.Get("username")
	db := DB(c)
	var currentUser models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&currentUser).Error; err != nil {
		c.JSON(500, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	organizatorTip := strings.TrimSpace(strings.ToLower(c.PostForm("organizatorTip")))
	if organizatorTip == "" {
		organizatorTip = "klub"
	}
	if organizatorTip != "klub" && organizatorTip != "vodic" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "organizatorTip mora biti klub ili vodic"})
		return
	}

	role, _ := c.Get("role")
	roleStr, _ := role.(string)
	isClubActionRole := roleStr == "admin" || roleStr == "vodic" || roleStr == "superadmin"
	if organizatorTip == "vodic" {
		if !helpers.KorisnikIsApprovedProfiGuide(db, currentUser.ID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Samo odobreni profi vodiči mogu kreirati akcije kao vodič"})
			return
		}
	} else if !isClubActionRole {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin, superadmin ili vodič mogu dodavati klupske akcije"})
		return
	}

	var clubID uint
	var klubIDPtr *uint
	if organizatorTip == "klub" {
		var ok bool
		clubID, ok = helpers.GetEffectiveClubID(c, db)
		if !ok || clubID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub (superadmin) ili niste u klubu."})
			return
		}
		klubIDPtr = &clubID
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeća forma"})
		return
	}

	naziv := c.PostForm("naziv")
	opis := c.PostForm("opis")
	zimskiUsponStr := c.PostForm("zimskiUspon")
	visinaVrhMStr := c.PostForm("visinaVrhM")
	vodicIDStr := c.PostForm("vodic_id")
	drugiVodicIme := c.PostForm("drugi_vodic_ime")
	javna := strings.ToLower(strings.TrimSpace(c.PostForm("javna"))) == "true"

	tipAkcije := strings.TrimSpace(strings.ToLower(c.PostForm("tipAkcije")))
	if tipAkcije == "" {
		tipAkcije = "planina"
	}
	if tipAkcije != "planina" && tipAkcije != "via_ferrata" {
		c.JSON(400, gin.H{"error": "Tip akcije mora biti planina ili via_ferrata"})
		return
	}

	var planina, vrh, tezina string
	var datum time.Time
	var kumulativniUsponM int
	var duzinaStazeKm float64
	var visinaVrhM int
	var ferrataIDPtr *uint
	var snapshotJSON json.RawMessage
	var startAtPtr *time.Time
	var planinaLatPtr, planinaLngPtr *float64

	if tipAkcije == "via_ferrata" {
		if strings.TrimSpace(naziv) == "" {
			c.JSON(400, gin.H{"error": "Naziv akcije je obavezan"})
			return
		}
		fidStr := strings.TrimSpace(c.PostForm("ferrataId"))
		if fidStr == "" {
			c.JSON(400, gin.H{"error": "Za via ferrata akciju morate izabrati feratu"})
			return
		}
		fid64, err := strconv.ParseUint(fidStr, 10, 32)
		if err != nil {
			c.JSON(400, gin.H{"error": "Nevažeći ID ferate"})
			return
		}
		fid := uint(fid64)
		var ft models.Ferrata
		if err := db.Where("id = ? AND status = ?", fid, "active").First(&ft).Error; err != nil {
			c.JSON(400, gin.H{"error": "Ferata nije pronađena ili nije aktivna"})
			return
		}
		st, err := parseViaFerrataStartAt(c.PostForm("startAt"))
		if err != nil {
			c.JSON(400, gin.H{"error": "Polje startAt (datum i vreme polaska) je obavezno u ispravnom formatu"})
			return
		}
		datum = calendarDatumUTCFromBelgradeClock(st)
		startAtCopy := st
		startAtPtr = &startAtCopy
		snap, err := buildFerrataSnapshotBytes(&ft)
		if err != nil {
			c.JSON(500, gin.H{"error": "Greška pri snapshot-u ferate"})
			return
		}
		snapshotJSON = snap
		ferrataIDPtr = &fid
		planina = strings.TrimSpace(ft.Drzava)
		if planina == "" {
			planina = "Via ferrata"
		}
		vrh = strings.TrimSpace(ft.Naziv)
		tezina = strings.TrimSpace(ft.Tezina)
		if tezina == "" {
			tezina = "srednje"
		}
		kumulativniUsponM = ft.VisinskaRazlikaM
		if kumulativniUsponM < 0 {
			kumulativniUsponM = 0
		}
		duzinaStazeKm = float64(ft.DuzinaM) / 1000.0
		if duzinaStazeKm < 0 {
			duzinaStazeKm = 0
		}
		visinaVrhM = 0
		planinaLatPtr, planinaLngPtr = ferrataLatLngPointers(&ft)
	} else {
		planina = strings.TrimSpace(c.PostForm("planina"))
		vrh = c.PostForm("vrh")
		datumStr := c.PostForm("datum")
		tezina = c.PostForm("tezina")
		kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
		duzinaStazeKmStr := c.PostForm("duzinaStazeKm")

		if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
			c.JSON(400, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
			return
		}
		if !isValidTezina(tezina) {
			c.JSON(400, gin.H{"error": "Izaberi težinu od ponuđenih"})
			return
		}
		var err error
		datum, err = time.Parse("2006-01-02", datumStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "Datum mora biti YYYY-MM-DD"})
			return
		}
		kumulativniUsponM, err = strconv.Atoi(kumulativniUsponMStr)
		if err != nil || kumulativniUsponM < 0 {
			c.JSON(400, gin.H{"error": "Kumulativni uspon mora biti ceo pozitivan broj (metri)"})
			return
		}
		duzinaStazeKm, err = strconv.ParseFloat(duzinaStazeKmStr, 64)
		if err != nil || duzinaStazeKm < 0 {
			c.JSON(400, gin.H{"error": "Dužina staze mora biti pozitivan broj (km)"})
			return
		}
		if strings.TrimSpace(visinaVrhMStr) != "" {
			visinaVrhM, err = strconv.Atoi(visinaVrhMStr)
			if err != nil || visinaVrhM < 0 {
				c.JSON(400, gin.H{"error": "Visina vrha mora biti ceo pozitivan broj (metri)"})
				return
			}
		}
		var em string
		planinaLatPtr, planinaLngPtr, em = parseRequiredPlaninaLatLng(c.PostForm("planinaLat"), c.PostForm("planinaLng"))
		if em != "" {
			c.JSON(400, gin.H{"error": em})
			return
		}
	}

	zimskiUspon := false
	if tipAkcije != "via_ferrata" {
		zimskiUspon = strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"
	}

	var vodicID uint
	if organizatorTip == "vodic" {
		vodicID = currentUser.ID
	} else if vodicIDStr != "" {
		if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
			vodicID = uint(vID)
		}
	}

	uIstorijiKluba := organizatorTip == "klub"

	akcija := models.Akcija{
		Naziv:                    naziv,
		Planina:                  planina,
		PlaninaLat:               planinaLatPtr,
		PlaninaLng:               planinaLngPtr,
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
		OrganizatorTip:           organizatorTip,
		UIstorijiKluba:           uIstorijiKluba,
		Javna:                    javna,
		KlubID:                   klubIDPtr,
		VodicID:                  vodicID,
		DrugiVodicIme:            strings.TrimSpace(drugiVodicIme),
		AddedByID:                currentUser.ID,
		TipAkcije:                tipAkcije,
		FerrataID:                ferrataIDPtr,
		FerrataSnapshotJSON:      snapshotJSON,
		StartAt:                  startAtPtr,
		BrojDana:                 1,
		PrikaziListuPrijavljenih: true,
	}
	if ok, errMsg := parseActionExtras(c, &akcija); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	if tipAkcije == "via_ferrata" && ferrataIDPtr != nil {
		var ftVia models.Ferrata
		if err := db.First(&ftVia, *ferrataIDPtr).Error; err == nil {
			applyViaFerrataAkcijaDefaults(&akcija, &ftVia)
		}
	}

	if err := db.Create(&akcija).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri čuvanju akcije"})
		return
	}
	if err := syncActionNestedData(db, akcija.ID, c); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if organizatorTip == "klub" && clubID > 0 {
		var notifyUserIDs []uint
		if javna {
			db.Model(&models.Korisnik{}).Where("klub_id IS NOT NULL").Pluck("id", &notifyUserIDs)
		} else {
			db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Pluck("id", &notifyUserIDs)
		}
		notifications.NotifyUsers(db, notifyUserIDs, models.ObavestenjeTipAkcija, "Nova akcija u kalendaru", akcija.Naziv, "/akcije/"+strconv.Itoa(int(akcija.ID)), fmt.Sprintf(`{"akcijaId":%d}`, akcija.ID))
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
	} else if tipAkcije == "via_ferrata" && ferrataIDPtr != nil {
		var ftCover models.Ferrata
		if err := db.First(&ftCover, *ferrataIDPtr).Error; err == nil {
			if u := strings.TrimSpace(ftCover.CoverImage); u != "" {
				akcija.SlikaURL = u
				_ = db.Model(&akcija).Update("slika_url", u).Error
			}
		}
	}

	resp := gin.H{
		"message": "Akcija dodata",
		"akcija":  akcija,
	}
	if !akcija.Javna {
		if rawToken, err := createActionInviteLinkForAkcija(db, akcija); err == nil {
			resp["inviteToken"] = rawToken
			resp["inviteUrl"] = fmt.Sprintf("%s/akcije/%d?inviteToken=%s", actionInvitePublicBaseURL(), akcija.ID, rawToken)
		}
	}

	c.JSON(201, resp)
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

	db := DB(c)
	var akcija models.Akcija
	if err := db.First(&akcija, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Akcija nije pronađena"})
		return
	}
	if !helpers.CanManageAkcijaEx(c, db, &akcija) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili vodič kluba koji je objavio akciju može da je menja"})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća forma"})
		return
	}

	naziv := c.PostForm("naziv")
	opis := c.PostForm("opis")
	zimskiUsponStr := c.PostForm("zimskiUspon")
	visinaVrhMStr := c.PostForm("visinaVrhM")
	vodicIDStr := c.PostForm("vodic_id")
	drugiVodicIme := c.PostForm("drugi_vodic_ime")
	if rawJavna := c.PostForm("javna"); rawJavna != "" {
		akcija.Javna = strings.ToLower(strings.TrimSpace(rawJavna)) == "true"
	}

	tipAkcije := strings.TrimSpace(strings.ToLower(c.PostForm("tipAkcije")))
	if tipAkcije == "" {
		tipAkcije = akcija.TipAkcije
	}
	if tipAkcije == "" {
		tipAkcije = "planina"
	}
	if tipAkcije != "planina" && tipAkcije != "via_ferrata" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tip akcije mora biti planina ili via_ferrata"})
		return
	}

	if tipAkcije == "via_ferrata" {
		if strings.TrimSpace(naziv) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Naziv akcije je obavezan"})
			return
		}
		fidStr := strings.TrimSpace(c.PostForm("ferrataId"))
		if fidStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Za via ferrata akciju morate izabrati feratu"})
			return
		}
		fid64, err := strconv.ParseUint(fidStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID ferate"})
			return
		}
		fid := uint(fid64)
		var ft models.Ferrata
		if err := db.Where("id = ? AND status = ?", fid, "active").First(&ft).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ferata nije pronađena ili nije aktivna"})
			return
		}
		st, err := parseViaFerrataStartAt(c.PostForm("startAt"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Polje startAt (datum i vreme polaska) je obavezno u ispravnom formatu"})
			return
		}
		datum := calendarDatumUTCFromBelgradeClock(st)
		startCopy := st
		prevID := uint(0)
		if akcija.FerrataID != nil {
			prevID = *akcija.FerrataID
		}
		if prevID != fid || len(akcija.FerrataSnapshotJSON) == 0 {
			snap, err := buildFerrataSnapshotBytes(&ft)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri snapshot-u ferate"})
				return
			}
			akcija.FerrataSnapshotJSON = snap
		}
		akcija.FerrataID = &fid
		akcija.StartAt = &startCopy
		akcija.Datum = datum
		akcija.TipAkcije = tipAkcije
		akcija.Naziv = naziv
		akcija.Opis = opis
		planina := strings.TrimSpace(ft.Drzava)
		if planina == "" {
			planina = "Via ferrata"
		}
		akcija.Planina = planina
		akcija.Vrh = strings.TrimSpace(ft.Naziv)
		akcija.Tezina = strings.TrimSpace(ft.Tezina)
		if akcija.Tezina == "" {
			akcija.Tezina = "srednje"
		}
		akcija.UkupnoMetaraUsponaAkcija = ft.VisinskaRazlikaM
		if akcija.UkupnoMetaraUsponaAkcija < 0 {
			akcija.UkupnoMetaraUsponaAkcija = 0
		}
		akcija.UkupnoKmAkcija = float64(ft.DuzinaM) / 1000.0
		akcija.VisinaVrhM = 0
		akcija.PlaninaLat, akcija.PlaninaLng = ferrataLatLngPointers(&ft)
	} else {
		akcija.FerrataID = nil
		akcija.FerrataSnapshotJSON = nil
		akcija.StartAt = nil
		akcija.EndAt = nil

		planina := strings.TrimSpace(c.PostForm("planina"))
		vrh := c.PostForm("vrh")
		datumStr := c.PostForm("datum")
		tezina := c.PostForm("tezina")
		kumulativniUsponMStr := c.PostForm("kumulativniUsponM")
		duzinaStazeKmStr := c.PostForm("duzinaStazeKm")

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

		akcija.Naziv = naziv
		akcija.Planina = planina
		akcija.Vrh = vrh
		akcija.Datum = datum
		akcija.Opis = opis
		akcija.Tezina = tezina
		akcija.UkupnoMetaraUsponaAkcija = kumulativniUsponM
		akcija.UkupnoKmAkcija = duzinaStazeKm
		akcija.TipAkcije = tipAkcije
		plt, plg, em := parseRequiredPlaninaLatLng(c.PostForm("planinaLat"), c.PostForm("planinaLng"))
		if em != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": em})
			return
		}
		akcija.PlaninaLat = plt
		akcija.PlaninaLng = plg
	}

	if tipAkcije == "via_ferrata" {
		akcija.ZimskiUspon = false
	} else if strings.TrimSpace(zimskiUsponStr) != "" {
		akcija.ZimskiUspon = strings.ToLower(strings.TrimSpace(zimskiUsponStr)) == "true"
	}

	var vodicID uint
	if vodicIDStr != "" {
		if vID, err := strconv.ParseUint(vodicIDStr, 10, 32); err == nil {
			vodicID = uint(vID)
		}
	}

	akcija.VodicID = vodicID
	akcija.DrugiVodicIme = strings.TrimSpace(drugiVodicIme)
	if ok, errMsg := parseActionExtras(c, &akcija); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	if tipAkcije == "via_ferrata" && akcija.FerrataID != nil {
		var ftVia models.Ferrata
		if err := db.First(&ftVia, *akcija.FerrataID).Error; err == nil {
			applyViaFerrataAkcijaDefaults(&akcija, &ftVia)
		}
	}

	if err := db.Save(&akcija).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju akcije"})
		return
	}
	if err := syncActionNestedData(db, akcija.ID, c); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
	} else if akcija.TipAkcije == "via_ferrata" && akcija.FerrataID != nil {
		var ftCover models.Ferrata
		if err := db.First(&ftCover, *akcija.FerrataID).Error; err == nil {
			if u := strings.TrimSpace(ftCover.CoverImage); u != "" {
				akcija.SlikaURL = u
				_ = db.Model(&akcija).Update("slika_url", u).Error
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Akcija uspešno ažurirana",
		"akcija":  akcija,
	})
}
