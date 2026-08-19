// Package geo sadrži pomoćne geografske funkcije za kasniji sistem vodiča.
//
// Planirano: model guide_profiles sa base_city, base_lat, base_lng, service_radius_km;
// udaljenost do ferratas.lat/lng (Haversine) za predlog najbližih vodiča.
// Ne koristi Google Distance Matrix niti rute — samo sferna udaljenost u km.
package geo

import "math"

const earthRadiusKm = 6371.0

// ValidLatLng je true samo za konačne koordinate u geografskom opsegu.
// 0,0 je validna tačka; nedostatak se ne sme mapirati na 0 u caller-u.
func ValidLatLng(lat, lng float64) bool {
	if math.IsNaN(lat) || math.IsInf(lat, 0) || math.IsNaN(lng) || math.IsInf(lng, 0) {
		return false
	}
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// DistanceKmHaversine vraća udaljenost između dve tačke na površi Zemlje u kilometrima.
func DistanceKmHaversine(lat1, lng1, lat2, lng2 float64) float64 {
	r1 := lat1 * math.Pi / 180
	r2 := lat2 * math.Pi / 180
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(r1)*math.Cos(r2)*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKm * c
}
