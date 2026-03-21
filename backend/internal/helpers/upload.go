package helpers

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
)

var allowedImageMIMEs = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

var allowedImageExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
	".gif":  true,
}

// ValidateImageFileHeader proverava da li je uploadovani fajl bezbedna i očekivana slika.
// Validira ekstenziju i MIME detekcijom sadržaja (magic bytes), ne samo ime fajla.
func ValidateImageFileHeader(fileHeader *multipart.FileHeader) error {
	if fileHeader == nil {
		return fmt.Errorf("fajl nije prosleđen")
	}

	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(fileHeader.Filename)))
	if !allowedImageExtensions[ext] {
		return fmt.Errorf("dozvoljene ekstenzije su: .jpg, .jpeg, .png, .webp, .gif")
	}

	f, err := fileHeader.Open()
	if err != nil {
		return fmt.Errorf("greška pri čitanju fajla")
	}
	defer f.Close()

	header := make([]byte, 512)
	n, err := f.Read(header)
	if err != nil || n == 0 {
		return fmt.Errorf("nevažeći fajl")
	}

	detected := strings.ToLower(strings.TrimSpace(http.DetectContentType(header[:n])))
	if !allowedImageMIMEs[detected] {
		return fmt.Errorf("dozvoljeni su samo image/jpeg, image/png, image/webp ili image/gif fajlovi")
	}

	return nil
}
