import { describe, expect, it } from 'vitest'
import {
  annotateGuidesWithDistance,
  formatDistanceKmDisplay,
  formatGuideDistancePart,
  isValidLatLng,
  resolvePointDistanceKm,
  sortByKnownDistanceAsc,
} from './geoDistance'

const BELGRADE = { lat: 44.7866, lng: 20.4489 }
const SAME = { lat: 44.7866, lng: 20.4489 }
/** ~10 km east of Belgrade (approx). */
const TEN_KM = { lat: 44.7866, lng: 20.575 }
const FAR = { lat: 43.8563, lng: 18.4131 } // Sarajevo, ~200 km

describe('isValidLatLng', () => {
  it('accepts real zeros as coordinates, rejects missing/NaN/out of range', () => {
    expect(isValidLatLng(0, 0)).toBe(true)
    expect(isValidLatLng(undefined, 20)).toBe(false)
    expect(isValidLatLng(44, undefined)).toBe(false)
    expect(isValidLatLng(Number.NaN, 20)).toBe(false)
    expect(isValidLatLng(91, 20)).toBe(false)
    expect(isValidLatLng(44, 200)).toBe(false)
  })
})

describe('resolvePointDistanceKm', () => {
  it('same location is approximately 0 km', () => {
    const km = resolvePointDistanceKm(BELGRADE.lat, BELGRADE.lng, SAME.lat, SAME.lng)
    expect(km).toBe(0)
    expect(formatDistanceKmDisplay(km)).toBe('0')
    expect(formatGuideDistancePart(km)).toBe('0 km')
  })

  it('~10 km is not 0', () => {
    const km = resolvePointDistanceKm(BELGRADE.lat, BELGRADE.lng, TEN_KM.lat, TEN_KM.lng)
    expect(km).not.toBeNull()
    expect(km!).toBeGreaterThan(8)
    expect(km!).toBeLessThan(12)
    expect(formatGuideDistancePart(km)).not.toBe('0 km')
  })

  it('100+ km stays the real distance, never 0', () => {
    const km = resolvePointDistanceKm(BELGRADE.lat, BELGRADE.lng, FAR.lat, FAR.lng)
    expect(km).not.toBeNull()
    expect(km!).toBeGreaterThan(100)
    expect(formatGuideDistancePart(km)).not.toBe('0 km')
  })

  it('missing guide coordinates → unavailable', () => {
    expect(resolvePointDistanceKm(BELGRADE.lat, BELGRADE.lng, undefined, 20)).toBeNull()
    expect(formatGuideDistancePart(null)).toBe('Udaljenost nije dostupna')
  })

  it('missing action coordinates → unavailable', () => {
    expect(resolvePointDistanceKm(undefined, undefined, BELGRADE.lat, BELGRADE.lng)).toBeNull()
  })

  it('invalid coordinates → unavailable (not 0)', () => {
    expect(resolvePointDistanceKm(99, 20, BELGRADE.lat, BELGRADE.lng)).toBeNull()
    expect(resolvePointDistanceKm(BELGRADE.lat, BELGRADE.lng, Number.NaN, 20)).toBeNull()
  })
})

describe('annotateGuidesWithDistance + sort', () => {
  it('strips catalog fake 0 when dest is valid and recomputes Haversine', () => {
    const farGuide = {
      id: 1,
      baseLat: FAR.lat,
      baseLng: FAR.lng,
      distanceKm: 0,
    }
    const [out] = annotateGuidesWithDistance([farGuide], BELGRADE.lat, BELGRADE.lng)
    expect(out.distanceKm).toBeGreaterThan(100)
  })

  it('unknown distance sorts after known, and is not treated as 0', () => {
    const unknown = { id: 1, distanceKm: undefined as number | undefined }
    const near = { id: 2, baseLat: TEN_KM.lat, baseLng: TEN_KM.lng, distanceKm: 0 }
    const far = { id: 3, baseLat: FAR.lat, baseLng: FAR.lng, distanceKm: 0 }
    const sorted = annotateGuidesWithDistance([unknown, far, near], BELGRADE.lat, BELGRADE.lng)
    expect(sorted.map((g) => g.id)).toEqual([2, 3, 1])
    expect(sorted[0].distanceKm).toBeGreaterThan(0)
    expect(sorted[2].distanceKm).toBeUndefined()
  })

  it('sortByKnownDistanceAsc does not put unknown first as 0', () => {
    const sorted = sortByKnownDistanceAsc(
      [{ id: 'u', km: undefined }, { id: 'z', km: 0 }, { id: 'f', km: 80 }],
      (x) => x.km,
    )
    expect(sorted.map((x) => x.id)).toEqual(['z', 'f', 'u'])
  })

  it('missing dest coords clears fake catalog 0', () => {
    const [out] = annotateGuidesWithDistance(
      [{ id: 1, baseLat: FAR.lat, baseLng: FAR.lng, distanceKm: 0 }],
      undefined,
      undefined,
    )
    expect(out.distanceKm).toBeUndefined()
    expect(formatGuideDistancePart(out.distanceKm)).toBe('Udaljenost nije dostupna')
  })
})
