package helpers

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var (
	ErrClubMemberLimit   = errors.New("Dostignut je maksimalan broj članova za ovaj klub")
	ErrClubAdminLimit    = errors.New("Dostignut je maksimalan broj admina za ovaj klub")
	ErrClubStorageLimit  = errors.New("Dostignut je limit prostora za ovaj klub (GB)")
)

const HoldDaysAfterSubscriptionEnd = 14
const WarningDaysAfterSubscriptionEnd = 7 // 7 dana posle isteka pošalji upozorenje da će za 7 dana klub na hold


const XClubIDHeader = "X-Club-Id"

func GetEffectiveClubID(c *gin.Context, db *gorm.DB) (clubID uint, ok bool) {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)

	if role != "superadmin" {
		if klubIDVal, exists := c.Get("klubId"); exists {
			if klubID, ok := klubIDVal.(uint); ok {
				return klubID, true
			}
		}
		usernameVal, _ := c.Get("username")
		username, _ := usernameVal.(string)
		if username == "" {
			return 0, true
		}
		var korisnik models.Korisnik
		if err := DBWhereUsername(db, username).First(&korisnik).Error; err != nil {
			return 0, true
		}
		if korisnik.KlubID != nil {
			return *korisnik.KlubID, true
		}
		return 0, true
	}


	raw := c.GetHeader(XClubIDHeader)
	if raw == "" {
		return 0, false
	}
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id == 0 {
		return 0, false
	}
	return uint(id), true
}

// CanManageAkcija: admin, vodič ili superadmin (sa X-Club-Id = klub akcije) može da uređuje akciju
// samo ako je effective klub jednak klubu na kojem je akcija kreirana (domaćin).
func CanManageAkcija(c *gin.Context, db *gorm.DB, akcijaKlubID *uint) bool {
	if akcijaKlubID == nil || *akcijaKlubID == 0 {
		return false
	}
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "admin" && role != "vodic" && role != "superadmin" {
		return false
	}
	effectiveClubID, ok := GetEffectiveClubID(c, db)
	if !ok {
		return false
	}
	return effectiveClubID == *akcijaKlubID
}

// CanManageAkcijaEx: klupske akcije — CanManageAkcija; vodičke — samo vodič koji vodi turu.
func CanManageAkcijaEx(c *gin.Context, db *gorm.DB, ak *models.Akcija) bool {
	if ak == nil {
		return false
	}
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	username, _ := c.Get("username")
	var u models.Korisnik
	userLoaded := DBWhereUsername(db, UsernameFromContext(username)).First(&u).Error == nil

	orgVodic := strings.TrimSpace(strings.ToLower(ak.OrganizatorTip)) == "vodic" && ak.VodicID > 0
	roleOk := role == "admin" || role == "vodic" || role == "superadmin"
	vodicMatch := userLoaded && u.ID == ak.VodicID
	addedByMatch := userLoaded && ak.AddedByID > 0 && u.ID == ak.AddedByID

	var result bool
	blockReason := "unknown"
	if orgVodic {
		if !roleOk {
			blockReason = "role_not_allowed"
		} else if !userLoaded {
			blockReason = "user_not_loaded"
		} else if vodicMatch {
			result = true
			blockReason = "vodic_id_match"
		} else {
			blockReason = "vodic_id_mismatch"
		}
	} else {
		result = CanManageAkcija(c, db, ak.KlubID)
		if result {
			blockReason = "club_manage"
		} else if ak.VodicID > 0 && vodicMatch && roleOk {
			result = true
			blockReason = "assigned_vodic"
		} else {
			blockReason = "club_manage_denied"
		}
	}

	// #region agent log
	AgentDebugLog("club.go:CanManageAkcijaEx", "CanManageAkcijaEx evaluated", "A-C", "pre-fix", map[string]any{
		"result":         result,
		"blockReason":    blockReason,
		"role":           role,
		"organizatorTip": ak.OrganizatorTip,
		"vodicId":        ak.VodicID,
		"addedById":      ak.AddedByID,
		"klubId":         ak.KlubID,
		"viewerId":       u.ID,
		"userLoaded":     userLoaded,
		"roleOk":         roleOk,
		"vodicMatch":     vodicMatch,
		"addedByMatch":   addedByMatch,
	})
	// #endregion

	return result
}

// IsClubOnHold čita samo klubovi.on_hold — bez side-effecta (za middleware i login).
func IsClubOnHold(db *gorm.DB, clubID uint) (bool, error) {
	var onHold bool
	err := db.Model(&models.Klubovi{}).Where("id = ?", clubID).Pluck("on_hold", &onHold).Error
	if err != nil {
		return false, err
	}
	return onHold, nil
}

// ProcessClubSubscriptionState ažurira hold/warning stanje kluba (za background job i superadmin).
// Šalje upozorenje adminima jednom u warning prozoru i postavlja on_hold posle grace period-a.
func ProcessClubSubscriptionState(db *gorm.DB, clubID uint) error {
	var club models.Klubovi
	if err := db.First(&club, clubID).Error; err != nil {
		return err
	}
	if club.SubscriptionEndsAt == nil {
		return nil
	}
	now := time.Now()
	end := *club.SubscriptionEndsAt
	holdDeadline := end.AddDate(0, 0, HoldDaysAfterSubscriptionEnd)
	warningWindowStart := end.AddDate(0, 0, WarningDaysAfterSubscriptionEnd)

	if !now.Before(warningWindowStart) && now.Before(holdDeadline) && club.SubscriptionWarningSentAt == nil {
		var adminIDs []uint
		if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role IN ?", clubID, []string{"admin", "sekretar"}).Pluck("id", &adminIDs).Error; err == nil && len(adminIDs) > 0 {
			title := "Upozorenje: klub će biti pauziran za 7 dana"
			body := "Subskripcija vašeg kluba \"" + club.Naziv + "\" je istekla. Ukoliko se subskripcija ne obnovi, klub će biti privremeno pauziran (hold) za 7 dana i članovi neće moći da se loguju. Kontaktirajte superadmina za produženje."
			notifications.NotifyUsers(db, adminIDs, models.ObavestenjeTipSubskripcija, title, body, "/home", "")
			t := now
			club.SubscriptionWarningSentAt = &t
			_ = db.Model(&club).Update("subscription_warning_sent_at", t)
		}
	}

	if now.After(holdDeadline) && !club.OnHold {
		club.OnHold = true
		return db.Save(&club).Error
	}
	return nil
}

// CheckClubLimitsForRegister proverava da li klub može da primi novog člana sa datom ulogom.
// Koristi se pre kreiranja korisnika u POST /api/register.
func CheckClubLimitsForRegister(db *gorm.DB, clubID uint, newRole string) error {
	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		return err
	}
	var memberCount int64
	if err := db.Model(&models.Korisnik{}).Where("klub_id = ?", clubID).Count(&memberCount).Error; err != nil {
		return err
	}
	if memberCount >= int64(klub.KorisnikLimit) {
		return fmt.Errorf("%w (max %d)", ErrClubMemberLimit, klub.KorisnikLimit)
	}
	// Admin je ograničen, sekretar nije (sekretar moze koliko zeli).
	if newRole == "admin" {
		var adminCount int64
		if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role = ?", clubID, "admin").Count(&adminCount).Error; err != nil {
			return err
		}
		if adminCount >= int64(klub.KorisnikAdminLimit) {
			return fmt.Errorf("%w (max %d)", ErrClubAdminLimit, klub.KorisnikAdminLimit)
		}
	}
	return nil
}

// CheckClubLimitsForRoleChange proverava da li je dozvoljeno promeniti ulogu na admin/sekretar u datom klubu.
// Koristi se u PATCH /api/korisnici/:id kada se postavlja role na admin ili sekretar.
func CheckClubLimitsForRoleChange(db *gorm.DB, clubID uint, currentRole, newRole string) error {
	// Limit važi samo za prelazak u ulogu "admin".
	if newRole != "admin" {
		return nil
	}
	if currentRole == "admin" {
		return nil // već je admin, broj se ne menja
	}
	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		return err
	}
	var adminCount int64
	if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role = ?", clubID, "admin").Count(&adminCount).Error; err != nil {
		return err
	}
	if adminCount >= int64(klub.KorisnikAdminLimit) {
		return fmt.Errorf("%w (max %d)", ErrClubAdminLimit, klub.KorisnikAdminLimit)
	}
	return nil
}

// CheckStorageLimit proverava da li upload veličine fileSizeBytes prekoračuje MaxStorageGB kluba.
// Pozvati pre upload-a. Ako clubID == 0, ne proverava (nema kluba).
func CheckStorageLimit(db *gorm.DB, clubID uint, fileSizeBytes int64) error {
	if clubID == 0 {
		return nil
	}
	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		return err
	}
	addGB := float64(fileSizeBytes) / 1e9
	if klub.UsedStorageGB+addGB > klub.MaxStorageGB {
		return fmt.Errorf("%w (max %.2f GB)", ErrClubStorageLimit, klub.MaxStorageGB)
	}
	return nil
}

// AddStorageUsage dodaje zauzeće (fileSizeBytes u GB) klubu. Pozvati tek posle uspešnog upload-a.
func AddStorageUsage(db *gorm.DB, clubID uint, fileSizeBytes int64) error {
	if clubID == 0 {
		return nil
	}
	addGB := float64(fileSizeBytes) / 1e9
	return db.Model(&models.Klubovi{}).Where("id = ?", clubID).Update("used_storage_gb", gorm.Expr("used_storage_gb + ?", addGB)).Error
}
