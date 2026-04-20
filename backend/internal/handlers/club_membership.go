package handlers

import (
	"beleg-app/backend/internal/helpers"
	"beleg-app/backend/internal/models"
	"beleg-app/backend/internal/notifications"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createClubJoinRequestBody struct {
	ClubID uint `json:"clubId"`
}

type removeMemberBody struct {
	UserID uint   `json:"userId"`
	Reason string `json:"reason"`
}

func GetPublicKluboviList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		q := db.Model(&models.Klubovi{})
		if search != "" {
			like := "%" + strings.ToLower(search) + "%"
			q = q.Where("LOWER(naziv) LIKE ?", like)
		}
		var klubovi []models.Klubovi
		if err := q.Order("naziv ASC").Limit(50).Find(&klubovi).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju klubova"})
			return
		}
		out := make([]gin.H, 0, len(klubovi))
		for _, k := range klubovi {
			out = append(out, gin.H{
				"id":      k.ID,
				"naziv":   k.Naziv,
				"adresa":  k.Adresa,
				"telefon": k.Telefon,
				"email":   k.Email,
				"logoUrl": k.LogoURL,
			})
		}
		c.JSON(http.StatusOK, gin.H{"klubovi": out})
	}
}

func currentUser(c *gin.Context, db *gorm.DB) (*models.Korisnik, bool) {
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Niste ulogovani"})
		return nil, false
	}
	username, _ := usernameVal.(string)
	var korisnik models.Korisnik
	if err := helpers.DBWhereUsername(db, helpers.UsernameFromContext(username)).First(&korisnik).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Korisnik nije pronađen"})
		return nil, false
	}
	return &korisnik, true
}

func hasBlock(db *gorm.DB, userID uint, clubID uint) bool {
	var cnt int64
	_ = db.Model(&models.ClubJoinBlock{}).Where("user_id = ? AND club_id = ?", userID, clubID).Count(&cnt).Error
	return cnt > 0
}

func CreateClubJoinRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	if user.KlubID != nil && *user.KlubID != 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Već ste član kluba. Napustite klub pre slanja novog zahteva."})
		return
	}

	var body createClubJoinRequestBody
	if err := c.ShouldBindJSON(&body); err != nil || body.ClubID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći clubId"})
		return
	}

	var klub models.Klubovi
	if err := db.First(&klub, body.ClubID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Klub nije pronađen"})
		return
	}
	if hasBlock(db, user.ID, body.ClubID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Ovaj klub je blokirao vaše zahteve."})
		return
	}

	var existing models.ClubJoinRequest
	if err := db.Where("user_id = ? AND club_id = ? AND status = ?", user.ID, body.ClubID, models.ClubJoinRequestPending).
		First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Već postoji aktivan zahtev za ovaj klub."})
		return
	}

	req := models.ClubJoinRequest{
		UserID: user.ID,
		ClubID: body.ClubID,
		Status: models.ClubJoinRequestPending,
	}
	if err := db.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri slanju zahteva"})
		return
	}

	var adminIDs []uint
	_ = db.Model(&models.Korisnik{}).
		Where("klub_id = ? AND role IN ? AND role != ?", body.ClubID, []string{"admin", "sekretar"}, "deleted").
		Pluck("id", &adminIDs).Error
	if len(adminIDs) > 0 {
		notifications.NotifyUsers(
			db,
			adminIDs,
			models.ObavestenjeTipBroadcast,
			"Novi zahtev za prijem u klub",
			fmt.Sprintf("%s je poslao/la zahtev za prijem u klub.", strings.TrimSpace(user.FullName)),
			"/klub",
			fmt.Sprintf(`{"clubJoinRequestId":%d}`, req.ID),
		)
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Zahtev je poslat.", "requestId": req.ID})
}

func GetMyClubJoinRequests(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}

	var reqs []models.ClubJoinRequest
	if err := db.Where("user_id = ?", user.ID).Order("created_at DESC").Find(&reqs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju zahteva"})
		return
	}
	clubIDs := make([]uint, 0)
	seen := map[uint]struct{}{}
	for _, r := range reqs {
		if _, ok := seen[r.ClubID]; ok {
			continue
		}
		seen[r.ClubID] = struct{}{}
		clubIDs = append(clubIDs, r.ClubID)
	}
	var clubs []models.Klubovi
	if len(clubIDs) > 0 {
		_ = db.Where("id IN ?", clubIDs).Find(&clubs).Error
	}
	clubNameByID := map[uint]string{}
	for _, club := range clubs {
		clubNameByID[club.ID] = club.Naziv
	}
	out := make([]gin.H, 0, len(reqs))
	for _, r := range reqs {
		out = append(out, gin.H{
			"id":        r.ID,
			"clubId":    r.ClubID,
			"clubNaziv": clubNameByID[r.ClubID],
			"status":    r.Status,
			"createdAt": r.CreatedAt,
			"updatedAt": r.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"requests": out})
}

func CancelMyClubJoinRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}
	var req models.ClubJoinRequest
	if err := db.Where("id = ? AND user_id = ?", id, user.ID).First(&req).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		return
	}
	if req.Status != models.ClubJoinRequestPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Možete povući samo pending zahtev"})
		return
	}
	if err := db.Model(&req).Update("status", models.ClubJoinRequestCancelled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri povlačenju zahteva"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Zahtev je povučen"})
}

func canManageOwnClubRequests(c *gin.Context, db *gorm.DB) (uint, bool) {
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	if role != "admin" && role != "sekretar" && role != "superadmin" {
		return 0, false
	}
	clubID, ok := helpers.GetEffectiveClubID(c, db)
	if !ok || clubID == 0 {
		return 0, false
	}
	return clubID, true
}

func ListClubJoinRequestsForAdmin(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := canManageOwnClubRequests(c, db)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo pristupa zahtevima kluba"})
		return
	}
	status := strings.TrimSpace(c.Query("status"))
	q := db.Where("club_id = ?", clubID)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var reqs []models.ClubJoinRequest
	if err := q.Order("created_at DESC").Find(&reqs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri učitavanju zahteva"})
		return
	}

	userIDs := make([]uint, 0, len(reqs))
	for _, r := range reqs {
		userIDs = append(userIDs, r.UserID)
	}
	var users []models.Korisnik
	if len(userIDs) > 0 {
		_ = db.Where("id IN ?", userIDs).Find(&users).Error
	}
	userByID := map[uint]models.Korisnik{}
	for _, u := range users {
		userByID[u.ID] = u
	}

	out := make([]gin.H, 0, len(reqs))
	for _, r := range reqs {
		u := userByID[r.UserID]
		out = append(out, gin.H{
			"id":        r.ID,
			"userId":    r.UserID,
			"username":  u.Username,
			"fullName":  u.FullName,
			"email":     u.Email,
			"status":    r.Status,
			"createdAt": r.CreatedAt,
			"updatedAt": r.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"requests": out})
}

func AcceptClubJoinRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := canManageOwnClubRequests(c, db)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da prihvatite zahtev"})
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}

	var req models.ClubJoinRequest
	if err := db.Where("id = ? AND club_id = ?", id, clubID).First(&req).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		return
	}
	if req.Status != models.ClubJoinRequestPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Samo pending zahtev se može prihvatiti"})
		return
	}

	var acceptedUser models.Korisnik
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&acceptedUser, req.UserID).Error; err != nil {
			return err
		}
		if acceptedUser.KlubID != nil && *acceptedUser.KlubID != 0 {
			return fmt.Errorf("korisnik je već član drugog kluba")
		}
		if err := tx.Model(&acceptedUser).Updates(map[string]any{
			"klub_id": clubID,
			"role":    "clan",
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.ClubJoinRequest{}).
			Where("id = ?", req.ID).
			Update("status", models.ClubJoinRequestAccepted).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.ClubJoinRequest{}).
			Where("user_id = ? AND id <> ? AND status = ?", req.UserID, req.ID, models.ClubJoinRequestPending).
			Update("status", models.ClubJoinRequestCancelled).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	notifications.NotifyUsers(
		db,
		[]uint{acceptedUser.ID},
		models.ObavestenjeTipBroadcast,
		"Zahtev je prihvaćen",
		"Vaš zahtev za prijem u klub je prihvaćen.",
		"/klub",
		"",
	)

	var memberIDs []uint
	_ = db.Model(&models.Korisnik{}).
		Where("klub_id = ? AND role != ?", clubID, "deleted").
		Pluck("id", &memberIDs).Error
	if len(memberIDs) > 0 {
		name := strings.TrimSpace(acceptedUser.FullName)
		if name == "" {
			name = acceptedUser.Username
		}
		notifications.NotifyUsers(
			db,
			memberIDs,
			models.ObavestenjeTipBroadcast,
			"Novi član kluba",
			fmt.Sprintf("%s je postao/la član kluba.", name),
			"/users",
			"",
		)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Zahtev je prihvaćen."})
}

func RejectClubJoinRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := canManageOwnClubRequests(c, db)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da odbijete zahtev"})
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}
	var req models.ClubJoinRequest
	if err := db.Where("id = ? AND club_id = ?", id, clubID).First(&req).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		return
	}
	if req.Status != models.ClubJoinRequestPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Samo pending zahtev se može odbiti"})
		return
	}
	if err := db.Model(&req).Update("status", models.ClubJoinRequestRejected).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri odbijanju zahteva"})
		return
	}
	notifications.NotifyUsers(
		db,
		[]uint{req.UserID},
		models.ObavestenjeTipBroadcast,
		"Zahtev je odbijen",
		"Vaš zahtev za prijem u klub je odbijen.",
		"/klub",
		"",
	)
	c.JSON(http.StatusOK, gin.H{"message": "Zahtev je odbijen."})
}

func BlockClubJoinRequest(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := canManageOwnClubRequests(c, db)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da blokirate zahtev"})
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći ID zahteva"})
		return
	}
	var req models.ClubJoinRequest
	if err := db.Where("id = ? AND club_id = ?", id, clubID).First(&req).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zahtev nije pronađen"})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&req).Updates(map[string]any{
			"status":     models.ClubJoinRequestBlocked,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}
		var block models.ClubJoinBlock
		if err := tx.Where("user_id = ? AND club_id = ?", req.UserID, clubID).First(&block).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return tx.Create(&models.ClubJoinBlock{UserID: req.UserID, ClubID: clubID}).Error
			}
			return err
		}
		return nil
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri blokiranju korisnika"})
		return
	}
	notifications.NotifyUsers(
		db,
		[]uint{req.UserID},
		models.ObavestenjeTipBroadcast,
		"Zahtev je blokiran",
		"Klub je blokirao dalje zahteve za prijem.",
		"/klub",
		"",
	)
	c.JSON(http.StatusOK, gin.H{"message": "Korisnik je blokiran za dalje zahteve ka ovom klubu."})
}

func LeaveCurrentClub(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	user, ok := currentUser(c, db)
	if !ok {
		return
	}
	if user.KlubID == nil || *user.KlubID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Niste član nijednog kluba."})
		return
	}
	if err := db.Model(user).Updates(map[string]any{
		"klub_id": nil,
		"role":    "",
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri napuštanju kluba"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Uspešno ste napustili klub."})
}

func RemoveMemberFromClub(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	clubID, ok := canManageOwnClubRequests(c, db)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nemate pravo da uklonite člana"})
		return
	}
	var body removeMemberBody
	if err := c.ShouldBindJSON(&body); err != nil || body.UserID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nevažeći podaci"})
		return
	}

	var user models.Korisnik
	if err := db.First(&user, body.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Korisnik nije pronađen"})
		return
	}
	if user.KlubID == nil || *user.KlubID != clubID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Korisnik nije član vašeg kluba"})
		return
	}
	if err := db.Model(&user).Updates(map[string]any{
		"klub_id": nil,
		"role":    "",
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Greška pri izbacivanju člana"})
		return
	}

	msg := "Uklonjeni ste iz kluba."
	reason := strings.TrimSpace(body.Reason)
	if reason != "" {
		msg += " Razlog: " + reason
	}
	notifications.NotifyUsers(
		db,
		[]uint{user.ID},
		models.ObavestenjeTipBroadcast,
		"Status članstva je promenjen",
		msg,
		"/home",
		"",
	)

	c.JSON(http.StatusOK, gin.H{"message": "Član je uklonjen iz kluba."})
}
