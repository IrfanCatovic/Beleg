/**
 * Zajednički geo tipovi za mapu i kasnije „najbliži vodič“ (guide_profiles.base_lat/base_lng).
 * Poslovna logika udaljenosti i upita nad vodičima ostaje van ovog modula.
 */

export type GeoPoint = {
  lat: number
  lng: number
}

/** Namena za buduće slojeve markera i spatijalne upite (nije još korišćeno u UI). */
export type PlaninerLocatableKind = 'ferrata' | 'peak' | 'scheduled_action' | 'guide_profile'

export type PlaninerLocatablePoint = {
  kind: PlaninerLocatableKind
  id: string | number
  point: GeoPoint
}
