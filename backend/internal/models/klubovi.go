package models

import "time"

type Klubovi struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Naziv          string    `gorm:"type:varchar(255)" json:"naziv"`
	Valuta         string    `gorm:"type:varchar(8);not null;default:'RSD'" json:"valuta"`
	Adresa         string    `gorm:"type:varchar(255)" json:"adresa,omitempty"`
	Telefon        string    `gorm:"type:varchar(50)" json:"telefon,omitempty"`
	Email          string    `gorm:"type:varchar(255)" json:"email,omitempty"`
	MaticniBroj    string    `gorm:"type:varchar(50)" json:"maticni_broj,omitempty"`
	PIB            string    `gorm:"type:varchar(50)" json:"pib,omitempty"`
	ZiroRacun      string    `gorm:"type:varchar(50)" json:"ziro_racun,omitempty"`
	Sediste        string    `gorm:"type:varchar(255)" json:"sediste,omitempty"`
	WebSajt        string    `gorm:"type:varchar(255)" json:"web_sajt,omitempty"`
	DatumOsnivanja time.Time `json:"datum_osnovanja,omitempty"`

	//limitirati broj admina i clanova
	KorisnikAdminLimit int     `gorm:"default:3" json:"korisnik_admin_limit"`
	KorisnikLimit      int     `gorm:"default:100" json:"korisnik_limit"`
	MaxStorageGB       float64 `gorm:"default:10.0" json:"max_storage_gb"`
	UsedStorageGB      float64 `gorm:"default:0" json:"used_storage_gb"` // ukupno GB zauzeto uploadima kluba

	// Subskripcija: kada se klub prvi put prijavio i do kad traje
	SubscribedAt       *time.Time `json:"subscribedAt,omitempty"`
	SubscriptionEndsAt *time.Time `json:"subscriptionEndsAt,omitempty"`

	// OnHold: true = klub suspendovan (14+ dana posle isteka subskripcije); članovi ne mogu da se loguju
	OnHold bool `gorm:"default:false" json:"onHold"`
	// SubscriptionWarningSentAt: kada je poslato upozorenje adminima (7 dana posle isteka) da će klub biti pauziran za 7 dana
	SubscriptionWarningSentAt *time.Time `json:"subscriptionWarningSentAt,omitempty"`

	LogoURL string `gorm:"type:varchar(500)" json:"logoUrl,omitempty"`

	// Invite kod za javnu samoregistraciju članova (globalno jedinstven; nil = još nije generisan)
	InviteCode              *string    `gorm:"size:16;uniqueIndex" json:"-"`
	InviteLastRegeneratedAt *time.Time `json:"-"`
	InviteExpiresAt         *time.Time `json:"-"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Klubovi) TableName() string {
	return "klubovi"
}
