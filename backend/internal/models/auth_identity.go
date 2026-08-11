package models

import "time"

const (
	AuthProviderGoogle = "google"
	AuthProviderApple  = "apple"
)

// AuthIdentity veže Planiner korisnika na vanjski identity provider (Google, kasnije Apple).
type AuthIdentity struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	KorisnikID     uint      `gorm:"not null;uniqueIndex:uidx_auth_user_provider" json:"korisnikId"`
	Provider       string    `gorm:"type:varchar(32);not null;uniqueIndex:uidx_auth_provider_sub;uniqueIndex:uidx_auth_user_provider" json:"provider"`
	ProviderUserID string    `gorm:"type:varchar(255);not null;uniqueIndex:uidx_auth_provider_sub" json:"providerUserId"`
	CreatedAt      time.Time `gorm:"autoCreateTime" json:"createdAt"`

	Korisnik Korisnik `gorm:"foreignKey:KorisnikID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
}

func (AuthIdentity) TableName() string {
	return "auth_identities"
}
