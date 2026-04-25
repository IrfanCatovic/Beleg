package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"context"
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
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var allowedTezineUsersAdmin = map[string]bool{"lako": true, "srednje": true, "tesko": true, "alpinizam": true}

func isValidTezinaUsersAdmin(tezina string) bool {
	return allowedTezineUsersAdmin[strings.TrimSpace(strings.ToLower(tezina))]
}

func getKorisnikByIDOrUsernameAdmin(db *gorm.DB, param string) *models.Korisnik {
	param = strings.TrimSpace(param)
	if param == "" {
		return nil
	}
	if id, err := strconv.Atoi(param); err == nil {
		var k models.Korisnik
		if db.First(&k, id).Error == nil && k.Role != "deleted" {
			return &k
		}
		return nil
	}
	var k models.Korisnik
	if helpers.DBWhereUsername(db, param).First(&k).Error == nil && k.Role != "deleted" {
		return &k
	}
	return nil
}

func UpdateKorisnikByAdmin(c *gin.Context) {
	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)
	isAdmin := roleStr == "admin" || roleStr == "superadmin"
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo admin ili superadmin mogu menjati korisnika"})
		return
	}
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID korisnika"})
		return
	}
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	var korisnik models.Korisnik
	if err := db.First(&korisnik, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if korisnik.Role == "deleted" {
		c.JSON(404, gin.H{"error": "Korisnik je deaktiviran i ne može se menjati"})
		return
	}
	if roleStr != "superadmin" {
		clubID, ok := helpers.GetEffectiveClubID(c, db)
		if !ok || clubID == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Nemate izabran klub"})
			return
		}
		if korisnik.KlubID == nil || *korisnik.KlubID != clubID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Možete menjati samo članove svog kluba"})
			return
		}
	}
	var body struct {
		Role                           string `json:"role"`
		IzreceneDisciplinskeKazne      string `json:"izreceneDisciplinskeKazne"`
		IzborUOrganeSportskogUdruzenja string `json:"izborUOrganeSportskogUdruzenja"`
		Napomene                       string `json:"napomene"`
		NewPassword                    string `json:"newPassword"`
	}
	_ = c.ShouldBindJSON(&body)

	if body.Role == "" {
		body.Role = korisnik.Role
	}
	if body.Role != "" && body.Role != korisnik.Role {
		validRoles := map[string]bool{"admin": true, "clan": true, "vodic": true, "blagajnik": true, "sekretar": true, "menadzer-opreme": true}
		if !validRoles[body.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeća uloga"})
			return
		}
		if korisnik.KlubID != nil && *korisnik.KlubID != 0 {
			if err := helpers.CheckClubLimitsForRoleChange(db, *korisnik.KlubID, korisnik.Role, body.Role); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
		}
	}
	updates := map[string]interface{}{
		"role":                               body.Role,
		"izrecene_disciplinske_kazne":        body.IzreceneDisciplinskeKazne,
		"izbor_u_organe_sportskog_udruzenja": body.IzborUOrganeSportskogUdruzenja,
		"napomene":                           body.Napomene,
	}
	if body.NewPassword != "" {
		if roleStr != "superadmin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Samo superadmin može da menja tuđu lozinku"})
			return
		}
		if len(body.NewPassword) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lozinka mora imati najmanje 8 karaktera"})
			return
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju lozinke"})
			return
		}
		updates["password"] = string(hashed)
	}
	if err := db.Model(&korisnik).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čuvanju"})
		return
	}
	if err := db.First(&korisnik, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju"})
		return
	}
	c.JSON(200, gin.H{"message": "Korisnik ažuriran", "korisnik": korisnik})
}

func DeleteKorisnikByAdmin(c *gin.Context) {
	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)
	if roleStr != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Samo superadmin može da obriše korisnika"})
		return
	}
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID korisnika"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	usernameVal, _ := c.Get("username")
	username, _ := usernameVal.(string)

	var korisnik models.Korisnik
	if err := db.First(&korisnik, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if korisnik.Username == username {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ne možete obrisati samog sebe"})
		return
	}
	if korisnik.Role == "deleted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Korisnik je već deaktiviran"})
		return
	}
	var transCount int64
	if err := db.Model(&models.Transakcija{}).Where("korisnik_id = ?", id).Count(&transCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri proveri transakcija"})
		return
	}
	if transCount > 0 {
		randomHash, _ := bcrypt.GenerateFromPassword([]byte(fmt.Sprintf("deleted-%d-%s", time.Now().UnixNano(), korisnik.Username)), bcrypt.DefaultCost)
		if err := db.Model(&korisnik).Updates(map[string]interface{}{"role": "deleted", "password": string(randomHash)}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri deaktivaciji korisnika"})
			return
		}
		c.JSON(200, gin.H{"message": "Korisnik je deaktiviran (ima unete transakcije, nalog ostaje za istoriju)"})
		return
	}

	db.Where("user_id = ?", id).Delete(&models.Obavestenje{})
	db.Where("korisnik_id = ?", id).Delete(&models.Prijava{})
	db.Where("korisnik_id = ?", id).Delete(&models.ZadatakKorisnik{})
	db.Model(&models.Transakcija{}).Where("clanarina_korisnik_id = ?", id).Update("clanarina_korisnik_id", nil)
	db.Model(&models.Akcija{}).Where("vodic_id = ?", id).Update("vodic_id", 0)
	db.Model(&models.Akcija{}).Where("added_by_id = ?", id).Update("added_by_id", 0)

	if err := db.Delete(&korisnik).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri brisanju korisnika"})
		return
	}
	c.JSON(200, gin.H{"message": "Korisnik je obrisan"})
}

func GetKorisnici(c *gin.Context) {
	dbAny, _ := c.Get("db")
	db := dbAny.(*gorm.DB)
	usernameVal, _ := c.Get("username")
	username, _ := usernameVal.(string)
	var currentUser models.Korisnik
	if err := helpers.DBWhereUsername(db, username).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	// Global search treba da radi i bez izabranog kluba.
	// Koristi se za pronalazak korisnika (profil/follow) preko header pretrage.
	if strings.EqualFold(strings.TrimSpace(c.Query("scope")), "global") {
		type PublicUserDTO struct {
			ID          uint   `json:"id"`
			Username    string `json:"username"`
			FullName    string `json:"fullName,omitempty"`
			AvatarURL   string `json:"avatar_url,omitempty"`
			Role        string `json:"role"`
			KlubID      *uint  `json:"klubId,omitempty"`
			KlubNaziv   string `json:"klubNaziv,omitempty"`
			KlubLogoURL string `json:"klubLogoUrl,omitempty"`
		}

		var blocks []models.Block
		_ = db.Where("blocker_id = ? OR blocked_id = ?", currentUser.ID, currentUser.ID).Find(&blocks).Error
		blockedSet := map[uint]struct{}{}
		for _, b := range blocks {
			if b.BlockerID == currentUser.ID {
				blockedSet[b.BlockedID] = struct{}{}
			} else if b.BlockedID == currentUser.ID {
				blockedSet[b.BlockerID] = struct{}{}
			}
		}

		var all []models.Korisnik
		if err := db.Preload("Klub").Where("role <> ?", "deleted").Find(&all).Error; err != nil {
			c.JSON(500, gin.H{"error": "Greška pri učitavanju korisnika"})
			return
		}

		out := make([]PublicUserDTO, 0, len(all))
		for i := range all {
			if all[i].ID == currentUser.ID {
				continue
			}
			if _, blocked := blockedSet[all[i].ID]; blocked {
				continue
			}
			dto := PublicUserDTO{ID: all[i].ID, Username: all[i].Username, FullName: all[i].FullName, AvatarURL: all[i].AvatarURL, Role: all[i].Role, KlubID: all[i].KlubID}
			if all[i].Klub != nil {
				dto.KlubNaziv = all[i].Klub.Naziv
				dto.KlubLogoURL = all[i].Klub.LogoURL
			}
			out = append(out, dto)
		}

		c.JSON(200, gin.H{"korisnici": out})
		return
	}

	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub na stranici Klubovi.", "korisnici": []models.Korisnik{}})
		return
	}
	if clubID == 0 {
		c.JSON(200, gin.H{"korisnici": []models.Korisnik{}})
		return
	}

	var korisnici []models.Korisnik
	if err := db.Preload("Klub").Where("klub_id = ? AND role != ?", clubID, "deleted").Find(&korisnici).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri učitavanju korisnika"})
		return
	}

	var blocks []models.Block
	_ = db.Where("blocker_id = ? OR blocked_id = ?", currentUser.ID, currentUser.ID).Find(&blocks).Error
	blockedSet := map[uint]struct{}{}
	for _, b := range blocks {
		if b.BlockerID == currentUser.ID {
			blockedSet[b.BlockedID] = struct{}{}
		} else if b.BlockedID == currentUser.ID {
			blockedSet[b.BlockerID] = struct{}{}
		}
	}

	filtered := make([]models.Korisnik, 0, len(korisnici))
	for i := range korisnici {
		if korisnici[i].ID != currentUser.ID {
			if _, blocked := blockedSet[korisnici[i].ID]; blocked {
				continue
			}
		}
		if korisnici[i].Klub != nil {
			korisnici[i].KlubNaziv = korisnici[i].Klub.Naziv
			korisnici[i].KlubLogoURL = korisnici[i].Klub.LogoURL
		}
		filtered = append(filtered, korisnici[i])
	}
	c.JSON(200, gin.H{"korisnici": filtered})
}

func GetKorisnikInfo(c *gin.Context) {
	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)
	if roleStr != "admin" && roleStr != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pristup ovim podacima"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)

	param := c.Param("id")
	korisnik := getKorisnikByIDOrUsernameAdmin(db, param)
	if korisnik == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}

	// Admin je ograničen na svoj/izabrani klub.
	// Superadmin može da otvori info za bilo kog korisnika (uključujući korisnike bez kluba).
	if roleStr == "admin" {
		clubID, ok := helpers.GetEffectiveClubID(c, db)
		if !ok || clubID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Izaberite klub"})
			return
		}
		if korisnik.KlubID == nil || *korisnik.KlubID != clubID {
			c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
			return
		}
	}

	c.JSON(http.StatusOK, korisnik)
}

func AddProslaAkcija(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "vodic" && role != "superadmin" {
		c.JSON(403, gin.H{"error": "Samo admin, superadmin ili vodič mogu da dodaju prošlu akciju"})
		return
	}

	idStr := c.Param("id")
	korisnikID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Nevažeći ID korisnika"})
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

	korisnikIDSet := map[uint]struct{}{uint(korisnikID): {}}
	rawIDFields := append(form.Value["korisnik_ids"], form.Value["korisnik_ids[]"]...)
	for _, rawField := range rawIDFields {
		parts := strings.Split(rawField, ",")
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			id64, convErr := strconv.ParseUint(part, 10, 32)
			if convErr != nil || id64 == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID korisnika u listi"})
				return
			}
			korisnikIDSet[uint(id64)] = struct{}{}
		}
	}

	korisnikIDs := make([]uint, 0, len(korisnikIDSet))
	for id := range korisnikIDSet {
		korisnikIDs = append(korisnikIDs, id)
	}
	if len(korisnikIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Potrebno je izabrati bar jednog člana"})
		return
	}

	var korisnici []models.Korisnik
	if err := db.Where("id IN ?", korisnikIDs).Find(&korisnici).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri čitanju korisnika"})
		return
	}
	if len(korisnici) != len(korisnikIDs) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Jedan ili više korisnika nisu pronađeni"})
		return
	}
	for _, korisnik := range korisnici {
		if korisnik.Role == "deleted" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nije moguće dodati deaktiviranog korisnika"})
			return
		}
		if korisnik.KlubID == nil || *korisnik.KlubID != clubID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Možete dodati prošlu akciju samo članovima iz izabranog kluba"})
			return
		}
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
	rawDodaj := c.PostForm("dodaj_u_istoriju_kluba")
	dodajUIstorijuKluba := strings.TrimSpace(strings.ToLower(rawDodaj)) != "false"
	javnaPast := strings.ToLower(strings.TrimSpace(c.PostForm("javna"))) == "true"
	log.Printf("AddPastAction: dodaj_u_istoriju_kluba='%s' → parsed=%v", rawDodaj, dodajUIstorijuKluba)

	if naziv == "" || planina == "" || vrh == "" || datumStr == "" || tezina == "" || kumulativniUsponMStr == "" || duzinaStazeKmStr == "" {
		c.JSON(400, gin.H{"error": "Sva polja su obavezna osim opisa, slike, visine vrha i zimskog uspona (naziv, ime planine, vrh, datum, težina, uspon i dužina staze)"})
		return
	}
	if !isValidTezinaUsersAdmin(tezina) {
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

	tipAkcije := strings.TrimSpace(strings.ToLower(c.PostForm("tipAkcije")))
	if tipAkcije == "" {
		tipAkcije = "planina"
	}
	if tipAkcije != "planina" && tipAkcije != "via_ferrata" {
		c.JSON(400, gin.H{"error": "tipAkcije mora biti planina ili via_ferrata"})
		return
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
		IsCompleted:              true,
		Javna:                    javnaPast,
		KlubID:                   &clubID,
		VodicID:                  vodicID,
		DrugiVodicIme:            strings.TrimSpace(drugiVodicIme),
		AddedByID:                currentUser.ID,
		UIstorijiKluba:           dodajUIstorijuKluba,
		TipAkcije:                tipAkcije,
		BrojDana:                 1,
		PrikaziListuPrijavljenih: true,
	}
	if ok, errMsg := parseActionExtras(c, &akcija); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}
	// Prošla akcija ne nosi finansijske stavke: bez troškova po članu/gostu.
	akcija.CenaClan = 0
	akcija.CenaOstali = 0
	akcija.MaxLjudi = 0

	if err := db.Create(&akcija).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri čuvanju akcije"})
		return
	}
	// Za prošlu akciju ne čuvamo dodatne troškove (smeštaj/oprema/prevoz rent).

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

	prijave := make([]models.Prijava, 0, len(korisnici))
	for _, korisnik := range korisnici {
		prijave = append(prijave, models.Prijava{
			AkcijaID:   akcija.ID,
			KorisnikID: korisnik.ID,
			Status:     "popeo se",
			Platio:     true,
		})
	}
	if err := db.Create(&prijave).Error; err != nil {
		c.JSON(500, gin.H{"error": "Greška pri dodavanju prijava"})
		return
	}

	for i := range korisnici {
		korisnici[i].UkupnoKmKorisnik += akcija.UkupnoKmAkcija
		korisnici[i].UkupnoMetaraUsponaKorisnik += akcija.UkupnoMetaraUsponaAkcija
		korisnici[i].BrojPopeoSe += 1
		if err := db.Save(&korisnici[i]).Error; err != nil {
			c.JSON(500, gin.H{"error": "Greška pri ažuriranju statistike korisnika"})
			return
		}
	}

	c.JSON(200, gin.H{"message": "Prošla akcija dodata", "korisnikIds": korisnikIDs, "brojKorisnika": len(korisnikIDs)})
}
