package helpers

import (
	"testing"

	"beleg-app/backend/internal/models"
)

func TestHasLogisticsChoices(t *testing.T) {
	if HasLogisticsChoices(nil, nil, nil) {
		t.Fatal("expected false for empty choices")
	}
	if !HasLogisticsChoices([]uint{1}, nil, nil) {
		t.Fatal("expected true when smestaj selected")
	}
	if !HasLogisticsChoices(nil, []uint{2}, nil) {
		t.Fatal("expected true when prevoz selected")
	}
	if !HasLogisticsChoices(nil, nil, []PrijavaRentItem{{RentID: 3, Kolicina: 1}}) {
		t.Fatal("expected true when rent selected")
	}
	if HasLogisticsChoices(nil, nil, []PrijavaRentItem{{RentID: 3, Kolicina: 0}}) {
		t.Fatal("expected false for zero rent qty")
	}
}

func TestIsActionGuide(t *testing.T) {
	akcija := models.Akcija{VodicID: 5}
	if !IsActionGuide(akcija, 5) {
		t.Fatal("expected guide match")
	}
	if IsActionGuide(akcija, 6) {
		t.Fatal("expected non-guide")
	}
	if IsActionGuide(models.Akcija{VodicID: 0}, 5) {
		t.Fatal("expected false when vodicID unset")
	}
}

func TestComputeSaldoForParticipant_GuideZeroWithoutChoices(t *testing.T) {
	klubID := uint(1)
	akcija := models.Akcija{
		ID:       10,
		VodicID:  7,
		KlubID:   &klubID,
		CenaClan: 50,
		Javna:    false,
	}
	korisnik := models.Korisnik{ID: 7, KlubID: &klubID}
	saldo := ComputeSaldoForParticipant(nil, akcija, korisnik, ParticipantChoices{})
	if saldo != 0 {
		t.Fatalf("expected guide saldo 0 without choices, got %v", saldo)
	}
}
