package jobs

import (
	"context"
	"log"
	"os"
	"time"

	"beleg-app/backend/internal/models"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api"
	"github.com/cloudinary/cloudinary-go/v2/api/admin"
	"gorm.io/gorm"
)

// RunCloudinaryPendingDeletesJob u pozadini svakih 24h briše iz Cloudinary slike koje su zamenjene (nakon 60 dana).
func RunCloudinaryPendingDeletesJob(db *gorm.DB) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	// Prvo pokretanje nakon 1 min da se server podigne
	time.Sleep(1 * time.Minute)
	for {
		runCloudinaryPendingDeletesOnce(db)
		<-ticker.C
	}
}

func runCloudinaryPendingDeletesOnce(db *gorm.DB) {
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")
	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return
	}
	cld, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		log.Println("[Cloudinary job] inicijalizacija:", err)
		return
	}
	ctx := context.Background()
	var pending []models.CloudinaryPendingDelete
	if err := db.Where("delete_after <= ?", time.Now()).Limit(100).Find(&pending).Error; err != nil {
		log.Println("[Cloudinary job] čitanje pending:", err)
		return
	}
	if len(pending) == 0 {
		return
	}
	publicIDs := make(api.CldAPIArray, 0, len(pending))
	idsToDelete := make([]uint, 0, len(pending))
	for _, p := range pending {
		publicIDs = append(publicIDs, p.PublicID)
		idsToDelete = append(idsToDelete, p.ID)
	}
	_, err = cld.Admin.DeleteAssets(ctx, admin.DeleteAssetsParams{
		PublicIDs: publicIDs,
		AssetType: api.Image,
	})
	if err != nil {
		log.Println("[Cloudinary job] DeleteAssets:", err)
		return
	}
	if err := db.Where("id IN ?", idsToDelete).Delete(&models.CloudinaryPendingDelete{}).Error; err != nil {
		log.Println("[Cloudinary job] brisanje zapisa:", err)
		return
	}
	log.Printf("[Cloudinary job] obrisano %d zamenjenih slika iz Cloudinary\n", len(idsToDelete))
}
