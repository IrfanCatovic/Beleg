package helpers

import (
	"errors"
	"fmt"
	"strconv"
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
		usernameVal, _ := c.Get("username")
		username, _ := usernameVal.(string)
		if username == "" {
			return 0, true
		}
		var korisnik models.Korisnik
		if err := db.Where("username = ?", username).First(&korisnik).Error; err != nil {
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

// EnsureClubHoldState učitava klub, i ako je subskripcija istekla pre više od HoldDaysAfterSubscriptionEnd dana,
// postavlja OnHold = true i čuva. Ako je 7 dana posle isteka (a pre 14), šalje upozorenje adminima jednom.
// Vraća da li je klub na hold-u (i ažurirani klub).
func EnsureClubHoldState(db *gorm.DB, clubID uint) (club *models.Klubovi, onHold bool) {
	var k models.Klubovi
	if err := db.First(&k, clubID).Error; err != nil {
		return nil, false
	}
	club = &k
	if club.SubscriptionEndsAt == nil {
		return club, club.OnHold
	}
	now := time.Now()
	end := *club.SubscriptionEndsAt
	holdDeadline := end.AddDate(0, 0, HoldDaysAfterSubscriptionEnd)
	warningWindowStart := end.AddDate(0, 0, WarningDaysAfterSubscriptionEnd)

	// 7 dana posle isteka: pošalji upozorenje adminima jednom (da će za 7 dana klub na hold ako se ne plati)
	if !now.Before(warningWindowStart) && now.Before(holdDeadline) && club.SubscriptionWarningSentAt == nil {
		var adminIDs []uint
		if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role IN ?", clubID, []string{"admin", "sekretar"}).Pluck("id", &adminIDs).Error; err == nil && len(adminIDs) > 0 {
			title := "Upozorenje: klub će biti pauziran za 7 dana"
			body := "Subskripcija vašeg kluba \"" + club.Naziv + "\" je istekla. Ukoliko se subskripcija ne obnovi, klub će biti privremeno pauziran (hold) za 7 dana i članovi neće moći da se loguju. Kontaktirajte superadmina za produženje."
			notifications.NotifyUsers(db, adminIDs, models.ObavestenjeTipSubskripcija, title, body, "/home")
			t := now
			club.SubscriptionWarningSentAt = &t
			_ = db.Model(club).Update("subscription_warning_sent_at", t)
		}
	}

	if now.After(holdDeadline) && !club.OnHold {
		club.OnHold = true
		_ = db.Save(club)
	}
	return club, club.OnHold
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
	if newRole == "admin" || newRole == "sekretar" {
		var adminCount int64
		if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role IN ?", clubID, []string{"admin", "sekretar"}).Count(&adminCount).Error; err != nil {
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
	if newRole != "admin" && newRole != "sekretar" {
		return nil
	}
	isAdminRole := func(r string) bool { return r == "admin" || r == "sekretar" }
	if isAdminRole(currentRole) {
		return nil // već je admin/sekretar, broj se ne menja
	}
	var klub models.Klubovi
	if err := db.First(&klub, clubID).Error; err != nil {
		return err
	}
	var adminCount int64
	if err := db.Model(&models.Korisnik{}).Where("klub_id = ? AND role IN ?", clubID, []string{"admin", "sekretar"}).Count(&adminCount).Error; err != nil {
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
