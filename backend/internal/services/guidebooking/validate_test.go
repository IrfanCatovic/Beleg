package guidebooking

import "testing"

func TestValidateCreateBooking(t *testing.T) {
	_, _, _, _, _, msg := ValidateCreateBooking(CreateBookingInput{
		DesiredDate:       "2026-06-15",
		TimeOfDay:         "morning",
		NumberOfPeople:    2,
		GroupExperience:   "mixed",
		EquipmentStatus:   "complete",
		ContactPhone:      "+381601234567",
	})
	if msg != "" {
		t.Fatalf("expected valid input, got %q", msg)
	}

	_, _, _, _, _, msg = ValidateCreateBooking(CreateBookingInput{DesiredDate: "bad"})
	if msg == "" {
		t.Fatal("expected date validation error")
	}

	_, _, _, _, _, msg = ValidateCreateBooking(CreateBookingInput{
		DesiredDate: "2026-06-15", TimeOfDay: "exact", NumberOfPeople: 1,
		GroupExperience: "mixed", EquipmentStatus: "complete", ContactPhone: "123",
	})
	if msg != "Unesite tačno vreme." {
		t.Fatalf("unexpected msg: %q", msg)
	}
}

func TestUniqueUints(t *testing.T) {
	got := UniqueUints([]uint{1, 1, 2, 0, 3})
	if len(got) != 3 || got[0] != 1 || got[1] != 2 || got[2] != 3 {
		t.Fatalf("unexpected result: %v", got)
	}
}

func TestValidateGuideTargets(t *testing.T) {
	if ValidateGuideTargets(true, nil) != "" {
		t.Fatal("skip guides should pass")
	}
	if ValidateGuideTargets(false, nil) == "" {
		t.Fatal("expected error without guides")
	}
}
