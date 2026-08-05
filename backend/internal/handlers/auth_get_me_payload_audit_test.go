package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"beleg-app/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// AUTH-A6 audit: documents /api/me full payload fields returned to own-user session.
func TestGetMe_PayloadFieldAudit(t *testing.T) {
	db := testGetMeDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
	dob := time.Date(1990, 5, 1, 0, 0, 0, 0, time.UTC)
	verified := time.Now()
	u := models.Korisnik{
		Username:                       "audituser",
		Password:                       string(hash),
		Role:                           "admin",
		FullName:                       "Audit User",
		ImeRoditelja:                   "Parent",
		Pol:                            "M",
		DatumRodjenja:                  &dob,
		Drzavljanstvo:                  "RS",
		Adresa:                         "Test St 1",
		Telefon:                        "+381600000000",
		Email:                          "audit@example.com",
		EmailVerifiedAt:                &verified,
		BrojLicnogDokumenta:            "ID123",
		BrojPlaninarskeLegitimacije:    "LEG456",
		BrojPlaninarskeMarkice:         "MK789",
		IzreceneDisciplinskeKazne:      "none",
		IzborUOrganeSportskogUdruzenja: "no",
		Napomene:                       "internal note",
		AvatarURL:                      "https://cdn/avatar.jpg",
		CoverImageURL:                  "https://cdn/cover.jpg",
		UkupnoKmKorisnik:               42.5,
		UkupnoMetaraUsponaKorisnik:     1200,
		BrojPopeoSe:                    7,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}

	status, body, raw := callGetMe(t, db, "audituser")
	if status != http.StatusOK {
		t.Fatalf("status %d", status)
	}

	expectedPresent := []string{
		"id", "username", "fullName", "ime_roditelja", "pol", "datum_rodjenja",
		"drzavljanstvo", "adresa", "telefon", "email", "email_verified_at",
		"broj_licnog_dokumenta", "broj_planinarske_legitimacije", "broj_planinarske_markice",
		"izrecene_disciplinske_kazne", "izbor_u_organe_sportskog_udruzenja", "napomene",
		"avatar_url", "cover_image_url", "role", "ukupnoKm", "ukupnoMetaraUspona",
		"brojPopeoSe", "createdAt", "updatedAt",
	}
	for _, key := range expectedPresent {
		if _, ok := body[key]; !ok {
			t.Errorf("expected field %q in /api/me response", key)
		}
	}

	forbidden := []string{`"password"`, "$2a$", "$2b$"}
	for _, f := range forbidden {
		if strings.Contains(raw, f) {
			t.Errorf("forbidden substring %q in response", f)
		}
	}

	if body["username"] != "audituser" || body["role"] != "admin" {
		t.Fatalf("unexpected identity: %v", body)
	}
	_ = json.Valid([]byte(raw))
}
