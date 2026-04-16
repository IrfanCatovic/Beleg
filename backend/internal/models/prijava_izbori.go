package models

type PrijavaIzbori struct {
	ID                   uint   `gorm:"primaryKey" json:"id"`
	PrijavaID            uint   `gorm:"index;not null;uniqueIndex" json:"prijavaId"`
	SelectedSmestajIDs   string `gorm:"type:text" json:"selectedSmestajIds"`
	SelectedPrevozIDs    string `gorm:"type:text" json:"selectedPrevozIds"`
	SelectedRentItemsRaw string `gorm:"type:text" json:"selectedRentItems"`
}

func (PrijavaIzbori) TableName() string {
	return "prijava_izbori"
}
