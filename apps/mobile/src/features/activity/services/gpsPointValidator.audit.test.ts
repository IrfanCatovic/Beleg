/**
 * Documents GPS validator after CORE FIX 1 (recovery + delayed delivery).
 */
import { describe, expect, it } from 'vitest'
import type { GPSPoint } from '@beleg/shared'
import {
  DEFAULT_GPS_VALIDATOR_CONFIG,
  emptyGpsFilterState,
  evaluateGpsPoint,
  validateGPSPoint,
} from './gpsPointValidator'

const NOW = Date.parse('2026-08-14T12:00:00.000Z')
const ORIGIN = { lat: 44.0165, lng: 21.0059 }

function northOf(lat: number, meters: number): number {
  return lat + meters / 111_320
}

function pt(
  metersNorth: number,
  accuracy: number | undefined,
  offsetMs: number,
  lat0 = ORIGIN.lat,
): GPSPoint {
  return {
    lat: northOf(lat0, metersNorth),
    lng: ORIGIN.lng,
    accuracy,
    recordedAt: new Date(NOW + offsetMs).toISOString(),
  }
}

function runSequence(points: GPSPoint[]) {
  const accepted: GPSPoint[] = []
  const rejected: { reason?: string; accuracy?: number }[] = []
  let state = emptyGpsFilterState()
  for (const p of points) {
    const pointMs = new Date(p.recordedAt).getTime()
    const { result, state: next } = evaluateGpsPoint(p, state, undefined, pointMs + 200)
    state = next
    if (result.accepted) accepted.push(p)
    else rejected.push({ reason: result.reason, accuracy: p.accuracy })
  }
  return { accepted, rejected }
}

describe('GPS validator after core fix', () => {
  it('straight walk: 10m / 5s / accuracy 12 → most points accepted', () => {
    const points: GPSPoint[] = [pt(0, 12, 0)]
    for (let i = 1; i <= 12; i++) {
      points.push(pt(i * 10, 12, i * 5000))
    }
    const { accepted, rejected } = runSequence(points)
    expect(accepted.length).toBeGreaterThanOrEqual(12)
    expect(rejected.filter((r) => r.reason !== 'too_close').length).toBe(0)
  })

  it('forest accuracy 5→15→25→40→18→8: accepts all ≤50m if spaced', () => {
    const acc = [5, 15, 25, 40, 18, 8]
    const points = acc.map((a, i) => pt(i * 12, a, i * 5000))
    const { accepted, rejected } = runSequence(points)
    expect(accepted.length).toBe(6)
    expect(rejected.length).toBe(0)
  })

  it('accuracy 50 accepted, 51 rejected (threshold is > 50)', () => {
    const ok = validateGPSPoint(pt(0, 50, 0), [], undefined, NOW + 1000)
    const bad = validateGPSPoint(pt(0, 51, 0), [], undefined, NOW + 1000)
    expect(ok.accepted).toBe(true)
    expect(bad.accepted).toBe(false)
    expect(bad.reason).toBe('accuracy_too_low')
  })

  it('serpentine 8m legs: minDistance 3m keeps them; 2m legs are dropped as too_close', () => {
    const coarse = [0, 8, 16, 22, 30, 38].map((m, i) => pt(m, 10, i * 4000))
    const { accepted: kept } = runSequence(coarse)
    expect(kept.length).toBeGreaterThanOrEqual(5)

    const fine = [0, 2, 4, 6, 8].map((m, i) => pt(m, 10, i * 4000))
    const { accepted: dropped } = runSequence(fine)
    expect(dropped.length).toBe(3)
    expect(dropped.map((p) => Math.round((p.lat - ORIGIN.lat) * 111_320))).toEqual([0, 4, 8])
  })

  it('single 600m jump is rejected; next nearby good point recovers', () => {
    const p1 = pt(0, 10, 0)
    const jump = pt(600, 10, 5000)
    const recover = pt(12, 10, 10_000)
    const { accepted, rejected } = runSequence([p1, jump, recover])
    expect(rejected.some((r) => r.reason === 'speed_too_high' || r.reason === 'jump_too_large')).toBe(
      true,
    )
    expect(accepted.length).toBe(2)
    expect(accepted[1].lat).toBe(recover.lat)
  })

  it('one poor-accuracy point does not cascade; later good hiking points recover', () => {
    const p1 = pt(0, 10, 0)
    const poor = pt(8, 100, 5000)
    const p3 = pt(40, 12, 15_000)
    const p4 = pt(48, 10, 20_000)
    const { accepted, rejected } = runSequence([p1, poor, p3, p4])
    expect(rejected.map((r) => r.reason)).toContain('accuracy_too_low')
    expect(accepted.length).toBe(3)
    expect(accepted[1].lat).toBe(p3.lat)
    expect(accepted[2].lat).toBe(p4.lat)
  })

  it('stationary drift < 3m is rejected as too_close (no extra points while standing)', () => {
    const points = [pt(0, 8, 0), pt(1.2, 8, 5000), pt(2.4, 9, 10_000)]
    const { accepted } = runSequence(points)
    expect(accepted.length).toBe(1)
  })

  it('delayed background delivery of a recent first point is not stale', () => {
    const p = pt(0, 8, 0)
    const result = validateGPSPoint(p, [], undefined, NOW + 40_000)
    expect(result.accepted).toBe(true)
  })

  it('background gap 5 min at walking distance is accepted (speed under 3.5 m/s)', () => {
    const p1 = pt(0, 10, 0)
    const p2 = pt(400, 10, 5 * 60 * 1000)
    const result = validateGPSPoint(p2, [p1], undefined, NOW + 5 * 60 * 1000)
    expect(result.accepted).toBe(true)
    expect(DEFAULT_GPS_VALIDATOR_CONFIG.maxWalkingSpeedMps).toBe(3.5)
  })

  it('background gap 5 min with 2000m displacement is rejected as jump/speed', () => {
    const p1 = pt(0, 10, 0)
    const p2 = pt(2000, 10, 5 * 60 * 1000)
    const result = validateGPSPoint(p2, [p1], undefined, NOW + 5 * 60 * 1000)
    expect(result.accepted).toBe(false)
    expect(['speed_too_high', 'jump_too_large']).toContain(result.reason)
  })
})
