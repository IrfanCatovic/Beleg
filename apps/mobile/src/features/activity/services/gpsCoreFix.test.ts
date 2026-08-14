import { describe, expect, it } from 'vitest'
import type { GPSPoint } from '@beleg/shared'
import { decodePolyline, encodePolyline, sumRouteDistanceM } from './activityMetrics'
import { emptyGpsFilterState, evaluateGpsPoint } from './gpsPointValidator'
import {
  ADVENTURE_GPS_ACCURACY_HIGH,
  ADVENTURE_GPS_DISTANCE_INTERVAL_M,
  ADVENTURE_GPS_TIME_INTERVAL_MS,
  ADVENTURE_IOS_ACTIVITY_TYPE_FITNESS,
} from './gpsLocationConstants'
import {
  buildLiveRouteLineString,
  gpsPointsToLngLat,
  shouldUpdateFollowCamera,
} from './liveRouteGeometry'
import { buildFinishRouteSnapshot, collectUnsentPoints } from './finishRouteSnapshot'
import { computeAdventureGpsStatus } from './gpsTrackStatus'
import { isPreciseLocationGranted } from './preciseLocation'

const NOW = Date.parse('2026-08-14T14:00:00.000Z')
const ORIGIN = { lat: 44.0165, lng: 21.0059 }

function northOf(meters: number): number {
  return ORIGIN.lat + meters / 111_320
}

function eastOf(meters: number): number {
  return ORIGIN.lng + meters / (111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180))
}

function pt(metersNorth: number, accuracy: number, offsetMs: number, metersEast = 0): GPSPoint {
  return {
    lat: northOf(metersNorth),
    lng: eastOf(metersEast),
    accuracy,
    recordedAt: new Date(NOW + offsetMs).toISOString(),
  }
}

function runFilter(points: GPSPoint[], ingestDelayMs = 200) {
  const accepted: GPSPoint[] = []
  const rejected: { point: GPSPoint; reason?: string }[] = []
  let state = emptyGpsFilterState()
  for (const p of points) {
    const recorded = new Date(p.recordedAt).getTime()
    const { result, state: next } = evaluateGpsPoint(p, state, undefined, recorded + ingestDelayMs)
    state = next
    if (result.accepted) accepted.push(p)
    else rejected.push({ point: p, reason: result.reason })
  }
  return { accepted, rejected, state }
}

describe('CORE FIX 1 acquisition contract', () => {
  it('uses High accuracy and hiking sampling (3s / 5m), Fitness activity type', () => {
    expect(ADVENTURE_GPS_ACCURACY_HIGH).toBe(4)
    expect(ADVENTURE_GPS_TIME_INTERVAL_MS).toBe(3000)
    expect(ADVENTURE_GPS_DISTANCE_INTERVAL_M).toBe(5)
    expect(ADVENTURE_IOS_ACTIVITY_TYPE_FITNESS).toBe(3)
  })
})

describe('A — normal walk', () => {
  it('accepts most 5m / 4s points with 5–15m accuracy', () => {
    const points = Array.from({ length: 16 }, (_, i) => pt(i * 5, 8 + (i % 3) * 3, i * 4000))
    const { accepted, rejected } = runFilter(points)
    expect(accepted.length).toBeGreaterThanOrEqual(14)
    expect(rejected.filter((r) => r.reason !== 'too_close' && r.reason !== 'time_delta_too_small').length).toBe(0)
  })
})

describe('B — slow walk does not imply weak GPS', () => {
  it('3 km/h with regular raw callbacks stays tracking', () => {
    const status = computeAdventureGpsStatus({
      trackingMode: 'background',
      nowMs: NOW + 60_000,
      trackingStartedAtMs: NOW,
      lastRawAtMs: NOW + 54_000,
      lastAcceptedAtMs: NOW + 48_000,
      lastRawAccuracy: 12,
      consecutiveAccuracyRejects: 0,
    })
    expect(status).toBe('tracking')
  })

  it('does not mark weak during the acquire grace window', () => {
    const status = computeAdventureGpsStatus({
      trackingMode: 'background',
      nowMs: NOW + 8_000,
      trackingStartedAtMs: NOW,
      lastRawAtMs: null,
      lastAcceptedAtMs: null,
      lastRawAccuracy: null,
      consecutiveAccuracyRejects: 0,
    })
    expect(status).toBe('tracking')
  })

  it('marks weak only after OS raw silence', () => {
    const status = computeAdventureGpsStatus({
      trackingMode: 'background',
      nowMs: NOW + 50_000,
      trackingStartedAtMs: NOW,
      lastRawAtMs: NOW + 20_000,
      lastAcceptedAtMs: NOW + 18_000,
      lastRawAccuracy: 10,
      consecutiveAccuracyRejects: 0,
    })
    expect(status).toBe('gps_weak')
  })
})

describe('C — forest accuracy sequence', () => {
  it('continues the route through 8–45m accuracy', () => {
    const acc = [8, 15, 25, 35, 45, 25, 12]
    const points = acc.map((a, i) => pt(i * 8, a, i * 4000))
    const { accepted } = runFilter(points)
    expect(accepted.length).toBe(acc.length)
  })
})

describe('D — bad accuracy does not cascade', () => {
  it('good → accuracy 100 → good → good recovers', () => {
    const seq = [pt(0, 10, 0), pt(6, 100, 4000), pt(14, 12, 9000), pt(22, 10, 14_000)]
    const { accepted, rejected } = runFilter(seq)
    expect(rejected.some((r) => r.reason === 'accuracy_too_low')).toBe(true)
    expect(accepted.map((p) => p.accuracy)).toEqual([10, 12, 10])
  })
})

describe('E — fake jump', () => {
  it('rejects 600m jump and accepts recovery near the trail', () => {
    const seq = [pt(0, 10, 0), pt(600, 10, 5000), pt(10, 10, 10_000)]
    const { accepted, rejected } = runFilter(seq)
    expect(rejected.some((r) => r.reason === 'speed_too_high' || r.reason === 'jump_too_large')).toBe(true)
    expect(accepted).toHaveLength(2)
    expect(accepted[1].lat).toBe(seq[2].lat)
  })
})

describe('F — serpentine geometry', () => {
  it('keeps enough curve so the polyline is not a single chord', () => {
    const points: GPSPoint[] = []
    for (let i = 0; i < 12; i++) {
      points.push(pt(i * 5, 10, i * 4000, Math.sin(i / 2) * 12))
    }
    const { accepted } = runFilter(points)
    expect(accepted.length).toBeGreaterThanOrEqual(8)
    const path = sumRouteDistanceM(accepted)
    const chord = sumRouteDistanceM([accepted[0], accepted[accepted.length - 1]])
    expect(path).toBeGreaterThan(chord * 1.08)
  })
})

describe('G — stationary jitter', () => {
  it('2–3m GPS drift does not inflate distance', () => {
    const points = [pt(0, 8, 0), pt(2.2, 9, 4000), pt(1.1, 8, 8000), pt(2.8, 10, 12_000)]
    const { accepted } = runFilter(points)
    expect(accepted).toHaveLength(1)
    expect(sumRouteDistanceM(accepted)).toBe(0)
  })
})

describe('H — delayed background callback', () => {
  it('does not drop a valid in-order point delivered 40s late', () => {
    const p1 = pt(0, 10, 0)
    const p2 = pt(12, 10, 5000)
    let state = emptyGpsFilterState()
    state = evaluateGpsPoint(p1, state, undefined, NOW + 200).state
    const late = evaluateGpsPoint(p2, state, undefined, NOW + 45_000)
    expect(late.result.accepted).toBe(true)
  })
})

describe('I — finish race uses canonical snapshot', () => {
  it('includes a point accepted just before finish in the polyline', () => {
    const queued: GPSPoint[] = [pt(0, 10, 0), pt(8, 10, 4000)]
    const lastAccepted = pt(16, 10, 8000)
    const memory = [...queued, lastAccepted]
    const snapshot = buildFinishRouteSnapshot(memory)
    const leftovers = collectUnsentPoints(snapshot.points, queued.length, [])
    const decoded = decodePolyline(snapshot.routePolyline)
    expect(leftovers).toHaveLength(1)
    expect(leftovers[0].lat).toBe(lastAccepted.lat)
    expect(decoded).toHaveLength(3)
    expect(Math.abs(decoded[2].lat - lastAccepted.lat)).toBeLessThan(1e-5)
    expect(snapshot.distanceM).toBeGreaterThan(10)
  })
})

describe('J — coordinate roundtrip', () => {
  it('internal lat/lng, Google polyline lat/lng, GeoJSON [lng, lat]', () => {
    const original = [
      { lat: 44.0165, lng: 21.0059 },
      { lat: 44.0171, lng: 21.0072 },
    ]
    const encoded = encodePolyline(original)
    const decoded = decodePolyline(encoded)
    decoded.forEach((p, i) => {
      expect(Math.abs(p.lat - original[i].lat)).toBeLessThan(1e-5)
      expect(Math.abs(p.lng - original[i].lng)).toBeLessThan(1e-5)
    })
    const geo = gpsPointsToLngLat(original)
    expect(geo[0]).toEqual([21.0059, 44.0165])
    expect(geo[1][0]).toBe(original[1].lng)
    expect(geo[1][1]).toBe(original[1].lat)
  })
})

describe('live map LineString helper', () => {
  it('0 points → no LineString', () => {
    expect(buildLiveRouteLineString([])).toBeNull()
  })

  it('1 point → no broken line', () => {
    expect(buildLiveRouteLineString([{ lat: 44, lng: 21 }])).toBeNull()
  })

  it('2+ points → valid LineString in [lng, lat] order', () => {
    const a = { lat: 44.0, lng: 21.0 }
    const b = { lat: 44.001, lng: 21.002 }
    const c = { lat: 44.002, lng: 21.003 }
    const line = buildLiveRouteLineString([a, b])
    expect(line?.geometry.type).toBe('LineString')
    expect(line?.geometry.coordinates).toEqual([
      [21.0, 44.0],
      [21.002, 44.001],
    ])
    const next = buildLiveRouteLineString([a, b, c])
    expect(next?.geometry.coordinates).toHaveLength(3)
    expect(next?.geometry.coordinates.slice(0, 2)).toEqual(line?.geometry.coordinates)
  })

  it('does not follow camera on every 5m tick', () => {
    const follow = shouldUpdateFollowCamera({
      lastFollowAtMs: NOW,
      lastFollowLngLat: [21.0059, 44.0165],
      nextLngLat: [eastOf(5), northOf(0)],
      nowMs: NOW + 1000,
    })
    expect(follow).toBe(false)
  })
})

describe('precise location gate', () => {
  it('rejects Android coarse / approximate', () => {
    expect(
      isPreciseLocationGranted({ status: 'granted', android: { accuracy: 'coarse' } }),
    ).toBe(false)
  })

  it('accepts Android fine', () => {
    expect(isPreciseLocationGranted({ status: 'granted', android: { accuracy: 'fine' } })).toBe(true)
  })

  it('rejects iOS reduced accuracy when Expo reports it', () => {
    expect(isPreciseLocationGranted({ status: 'granted', ios: { accuracy: 'reduced' } })).toBe(false)
  })

  it('accepts iOS full accuracy', () => {
    expect(isPreciseLocationGranted({ status: 'granted', ios: { accuracy: 'full' } })).toBe(true)
  })

  it('does not invent a reduced signal when the platform field is missing', () => {
    expect(isPreciseLocationGranted({ status: 'granted' })).toBe(true)
  })
})

describe('live map wiring contract (source)', () => {
  it('ActivityLiveMap draws LineString and has no per-point Marker/Circle', async () => {
    const { readFile } = await import('node:fs/promises')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = await readFile(join(dir, '../components/ActivityLiveMap.tsx'), 'utf8')
    expect(src).toContain('buildLiveRouteLineString')
    expect(src).toContain('type="line"')
    expect(src).not.toMatch(/<Marker/)
    expect(src).not.toMatch(/CircleLayer/)
    expect(src).not.toMatch(/points\.map\(/)
  })

  it('AdventureScreen mounts ActivityLiveMap with tracker.routePoints', async () => {
    const { readFile } = await import('node:fs/promises')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = await readFile(join(dir, '../screens/AdventureScreen.tsx'), 'utf8')
    expect(src).toContain('<ActivityLiveMap')
    expect(src).toContain('tracker.routePoints')
  })
})
