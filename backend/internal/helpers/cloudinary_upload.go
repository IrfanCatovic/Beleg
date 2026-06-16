package helpers

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

// UploadImage uploads a readable image stream to Cloudinary.
func UploadImage(folder, publicID string, reader io.Reader) (string, error) {
	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		return "", fmt.Errorf("cloudinary init: %w", err)
	}
	ctx := context.Background()
	uploadParams := uploader.UploadParams{
		PublicID:       publicID,
		Folder:         folder,
		Transformation: "q_auto:good,f_auto",
	}
	uploadResult, err := cld.Upload.Upload(ctx, reader, uploadParams)
	if err != nil {
		return "", fmt.Errorf("cloudinary upload: %w", err)
	}
	return uploadResult.SecureURL, nil
}

// UploadImageFileHeader validates and uploads a multipart file header.
func UploadImageFileHeader(file *multipart.FileHeader, folder, publicID string) (secureURL string, size int64, err error) {
	if err = ValidateImageFileHeader(file); err != nil {
		return "", 0, err
	}
	fp, err := file.Open()
	if err != nil {
		return "", 0, err
	}
	defer fp.Close()
	url, err := UploadImage(folder, publicID, fp)
	if err != nil {
		return "", 0, err
	}
	return url, file.Size, nil
}
