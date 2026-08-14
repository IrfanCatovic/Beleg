import { describe, expect, it } from 'vitest'
import type { GPSPoint } from '@beleg/shared'
import {
  DEFAULT_GPS_VALIDATOR_CONFIG,
  emptyGpsFilterState,
  evaluateGpsPoint,
  validateGPSPoint,
  type GpsFilterState,
} from './gpsPointValidator'

const NOW = Date.parse('2026-07-04T12:00:00.000Z')

function point(
  lat: number,
  lng: number,
  accuracy: number | undefined,
  offsetMs = 0,
): GPSPoint {
  return {
    lat,
    lng,
    accuracy,
    recordedAt: new Date(NOW + offsetMs).toISOString(),
  }
}

describe('validateGPSPoint', () => {
  it('accepts first point with accuracy 20m', () => {
    const result = validateGPSPoint(point(44.0165, 21.0059, 20), [], undefined, NOW + 5000)
    expect(result.accepted).toBe(true)
    expect(result.distanceDeltaM).toBe(0)
  })

  it('rejects first point with accuracy 120m', () => {
    const result = validateGPSPoint(point(44.0165, 21.0059, 120), [], undefined, NOW + 5000)
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('accuracy_too_low')
  })

  it('rejects second point 300m away in 5s (speed/jump)', () => {
    const first = point(44.0165, 21.0059, 20, 0)
    const second = point(44.0192, 21.0059, 20, 5000)
    const result = validateGPSPoint(second, [first], undefined, NOW + 5000)
    expect(result.accepted).toBe(false)
    expect(['speed_too_high', 'jump_too_large']).toContain(result.reason)
  })

  it('accepts second point 10m away in 5s', () => {
    const first = point(44.0165, 21.0059, 20, 0)
    const second = point(44.01659, 21.0059, 20, 5000)
    const result = validateGPSPoint(second, [first], undefined, NOW + 5000)
    expect(result.accepted).toBe(true)
    expect(result.distanceDeltaM).toBeGreaterThan(3)
    expect(result.speedMps).toBeLessThanOrEqual(3.5)
  })

  it('rejects point without accuracy', () => {
    const result = validateGPSPoint(point(44.0165, 21.0059, undefined), [], undefined, NOW)
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('accuracy_too_low')
  })

  it('accepts delayed delivery of a recent first point (background batch)', () => {
    const result = validateGPSPoint(
      point(44.0165, 21.0059, 20, 0),
      [],
      undefined,
      NOW + 40_000,
    )
    expect(result.accepted).toBe(true)
  })

  it('rejects orphan first point older than maxOrphanAgeMs', () => {
    const result = validateGPSPoint(
      point(44.0165, 21.0059, 20, 0),
      [],
      undefined,
      NOW + DEFAULT_GPS_VALIDATOR_CONFIG.maxOrphanAgeMs + 1000,
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('stale_timestamp')
  })

  it('rejects point less than 3m from previous as noise', () => {
    const first = point(44.0165, 21.0059, 20, 0)
    const second = point(44.01651, 21.00591, 20, 5000)
    const result = validateGPSPoint(second, [first], undefined, NOW + 5000)
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('too_close')
  })

  it('rejects out-of-order timestamp vs last accepted', () => {
    const first = point(44.0165, 21.0059, 20, 10_000)
    const earlier = point(44.01659, 21.0059, 20, 0)
    let state: GpsFilterState = emptyGpsFilterState()
    state = evaluateGpsPoint(first, state, undefined, NOW + 10_000).state
    const result = evaluateGpsPoint(earlier, state, undefined, NOW + 12_000).result
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('stale_timestamp')
  })
})
