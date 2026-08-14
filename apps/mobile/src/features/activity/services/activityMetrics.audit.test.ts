/**
 * AUDIT-ONLY: documents current polyline precision and metric helpers.
 * Production encode/decode is not changed.
 */
import { describe, expect, it } from 'vitest'
import {
  decodePolyline,
  encodePolyline,
  sumRouteDistanceM,
  computeElevationGainM,
  type LatLngAlt,
} from './activityMetrics'

describe('AUDIT polyline encode/decode (Google precision 1e5)', () => {
  it('round-trips four known coordinates within 1e-5 degrees', () => {
    const original: LatLngAlt[] = [
      { lat: 44.0165, lng: 21.0059 },
      { lat: 44.0171, lng: 21.0072 },
      { lat: 44.0188, lng: 21.0061 },
      { lat: 44.0200, lng: 21.0095 },
    ]
    const encoded = encodePolyline(original)
    const decoded = decodePolyline(encoded)
    expect(decoded).toHaveLength(4)
    decoded.forEach((p, i) => {
      expect(Math.abs(p.lat - original[i].lat)).toBeLessThan(1e-5)
      expect(Math.abs(p.lng - original[i].lng)).toBeLessThan(1e-5)
    })
  })
})

describe('AUDIT distance/elevation current helpers', () => {
  it('sumRouteDistanceM uses the given point list as-is (accepted points if caller passes those)', () => {
    const points: LatLngAlt[] = [
      { lat: 44.0, lng: 21.0 },
      { lat: 44.001, lng: 21.0 },
    ]
    const d = sumRouteDistanceM(points)
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(130)
  })

  it('elevation gain ignores deltas below 3m and missing altitude', () => {
    const points: LatLngAlt[] = [
      { lat: 44.0, lng: 21.0, altitude: 100 },
      { lat: 44.001, lng: 21.0, altitude: 102 },
      { lat: 44.002, lng: 21.0, altitude: 106 },
      { lat: 44.003, lng: 21.0 },
    ]
    expect(computeElevationGainM(points)).toBe(4)
  })
})
