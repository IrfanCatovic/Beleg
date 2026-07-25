package handlers

import "beleg-app/backend/internal/models"

// PublicUserDTO — eksplicitni privacy-safe odgovor za liste korisnika
// (GET /api/korisnici global i club). Ne koristi models.Korisnik kao JSON shape.
type PublicUserDTO struct {
	ID                 uint    `json:"id"`
	Username           string  `json:"username"`
	FullName           string  `json:"fullName,omitempty"`
	AvatarURL          string  `json:"avatar_url,omitempty"`
	Role               string  `json:"role"`
	KlubID             *uint   `json:"klubId,omitempty"`
	KlubNaziv          string  `json:"klubNaziv,omitempty"`
	KlubLogoURL        string  `json:"klubLogoUrl,omitempty"`
	IsProfiGuide       bool    `json:"isProfiGuide,omitempty"`
	UkupnoKm           float64 `json:"ukupnoKm,omitempty"`
	UkupnoMetaraUspona int     `json:"ukupnoMetaraUspona,omitempty"`
	BrojPopeoSe        int     `json:"brojPopeoSe,omitempty"`
}

// BuildPublicUserDTO kopira samo dozvoljena javna polja. Nova privatna kolona
// na models.Korisnik se ovdje neće automatski pojaviti.
func BuildPublicUserDTO(k models.Korisnik, isProfiGuide bool) PublicUserDTO {
	dto := PublicUserDTO{
		ID:                 k.ID,
		Username:           k.Username,
		FullName:           k.FullName,
		AvatarURL:          k.AvatarURL,
		Role:               k.Role,
		KlubID:             k.KlubID,
		IsProfiGuide:       isProfiGuide,
		UkupnoKm:           k.UkupnoKmKorisnik,
		UkupnoMetaraUspona: k.UkupnoMetaraUsponaKorisnik,
		BrojPopeoSe:        k.BrojPopeoSe,
	}
	if k.Klub != nil {
		dto.KlubNaziv = k.Klub.Naziv
		dto.KlubLogoURL = k.Klub.LogoURL
	} else {
		dto.KlubNaziv = k.KlubNaziv
		dto.KlubLogoURL = k.KlubLogoURL
	}
	return dto
}
