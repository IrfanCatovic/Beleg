package helpers

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	_ "golang.org/x/image/webp"
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

const (
	maxImageWidth  = 8000
	maxImageHeight = 8000
	maxImagePixels = 25_000_000 // ~25MP limit (npr 5000x5000)
)

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

	f2, err := fileHeader.Open()
	if err != nil {
		return fmt.Errorf("greška pri čitanju fajla")
	}
	defer f2.Close()

	cfg, _, err := image.DecodeConfig(f2)
	if err != nil {
		return fmt.Errorf("neispravan format slike")
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return fmt.Errorf("slika mora imati validne dimenzije")
	}
	if cfg.Width > maxImageWidth || cfg.Height > maxImageHeight {
		return fmt.Errorf("slika je prevelikih dimenzija (maks %dx%d)", maxImageWidth, maxImageHeight)
	}
	if cfg.Width*cfg.Height > maxImagePixels {
		return fmt.Errorf("slika je prevelika po broju piksela")
	}

	return nil
}
