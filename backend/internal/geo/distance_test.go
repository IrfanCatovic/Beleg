package geo

import (
	"math"
	"testing"
)

func TestValidLatLng(t *testing.T) {
	if !ValidLatLng(0, 0) {
		t.Fatal("0,0 is a valid coordinate")
	}
	if ValidLatLng(99, 20) {
		t.Fatal("lat 99 invalid")
	}
	if ValidLatLng(math.NaN(), 20) {
		t.Fatal("NaN invalid")
	}
}

func TestDistanceKmHaversine_SamePoint(t *testing.T) {
	d := DistanceKmHaversine(44.7866, 20.4489, 44.7866, 20.4489)
	if d > 0.001 {
		t.Fatalf("same point want ~0, got %f", d)
	}
}

func TestDistanceKmHaversine_NotZeroWhenFar(t *testing.T) {
	d := DistanceKmHaversine(44.7866, 20.4489, 43.8563, 18.4131)
	if d < 100 {
		t.Fatalf("Belgrade–Sarajevo should be 100+ km, got %f", d)
	}
}

func TestDistanceKmHaversine_About10km(t *testing.T) {
	d := DistanceKmHaversine(44.7866, 20.4489, 44.7866, 20.575)
	if d < 8 || d > 12 {
		t.Fatalf("expected ~10 km, got %f", d)
	}
}
