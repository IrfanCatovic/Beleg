/** Canonical geographic helpers — Haversine km, never Euclidean lat/lng. */

const EARTH_RADIUS_KM = 6371

export function isValidLatLng(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function distanceKmHaversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r1 = (lat1 * Math.PI) / 180
  const r2 = (lat2 * Math.PI) / 180
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(r1) * Math.cos(r2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function roundDistanceKm(km: number): number {
  return Math.round(km * 100) / 100
}

/** null = distance is unknown (never coerce to 0). */
export function resolvePointDistanceKm(
  fromLat?: number | null,
  fromLng?: number | null,
  toLat?: number | null,
  toLng?: number | null,
): number | null {
  if (!isValidLatLng(fromLat, fromLng) || !isValidLatLng(toLat, toLng)) return null
  return roundDistanceKm(distanceKmHaversine(fromLat as number, fromLng as number, toLat as number, toLng as number))
}

/** Display digits, or null when unavailable. Real 0 stays "0". */
export function formatDistanceKmDisplay(km?: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null
  const rounded = Math.round(km * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

export function formatGuideDistancePart(km?: number | null): string {
  const shown = formatDistanceKmDisplay(km)
  if (shown == null) return 'Udaljenost nije dostupna'
  return `${shown} km`
}

export function sortByKnownDistanceAsc<T>(items: T[], getKm: (item: T) => number | null | undefined): T[] {
  return [...items].sort((a, b) => {
    const da = getKm(a)
    const db = getKm(b)
    const aKnown = da != null && Number.isFinite(da)
    const bKnown = db != null && Number.isFinite(db)
    if (aKnown && bKnown) return (da as number) - (db as number)
    if (aKnown && !bKnown) return -1
    if (!aKnown && bKnown) return 1
    return 0
  })
}

export function annotateGuidesWithDistance<T extends { baseLat?: number; baseLng?: number; distanceKm?: number | null }>(
  guides: T[],
  destLat?: number | null,
  destLng?: number | null,
): T[] {
  const annotated = guides.map((g) => {
    const km = resolvePointDistanceKm(destLat, destLng, g.baseLat, g.baseLng)
    return { ...g, distanceKm: km ?? undefined }
  })
  return sortByKnownDistanceAsc(annotated, (g) => g.distanceKm)
}
