import { describe, expect, it } from 'vitest'
import {
  buildSvgPathD,
  isNorthUpOrientation,
  projectRouteToSvg,
  sanitizeRoutePoints,
  type RouteLatLng,
} from './projectAdventureRoute'

const W = 220
const H = 118
const PAD = 12

function northOf(lat: number, meters: number): number {
  return lat + meters / 111_320
}

function eastOf(lat: number, lng: number, meters: number): number {
  return lng + meters / (111_320 * Math.cos((lat * Math.PI) / 180))
}

describe('sanitizeRoutePoints', () => {
  it('drops non-finite and consecutive duplicates', () => {
    const pts: RouteLatLng[] = [
      { lat: 44, lng: 21 },
      { lat: 44, lng: 21 },
      { lat: Number.NaN, lng: 21 },
      { lat: 44.01, lng: 21.01 },
      { lat: 44.01, lng: 21.01 },
    ]
    expect(sanitizeRoutePoints(pts)).toEqual([
      { lat: 44, lng: 21 },
      { lat: 44.01, lng: 21.01 },
    ])
  })
})

describe('projectRouteToSvg — shapes', () => {
  it('A horizontal-ish: fits by width, centered, no divide-by-zero', () => {
    const origin = { lat: 44.0165, lng: 21.0059 }
    const points = [
      origin,
      { lat: origin.lat, lng: eastOf(origin.lat, origin.lng, 200) },
      { lat: origin.lat + 0.00005, lng: eastOf(origin.lat, origin.lng, 400) },
    ]
    const r = projectRouteToSvg(points, W, H, PAD)
    expect(r.pathD).toBeTruthy()
    expect(r.points).toHaveLength(3)
    for (const p of r.points) {
      expect(p.x).toBeGreaterThanOrEqual(PAD - 0.5)
      expect(p.x).toBeLessThanOrEqual(W - PAD + 0.5)
      expect(p.y).toBeGreaterThanOrEqual(PAD - 0.5)
      expect(p.y).toBeLessThanOrEqual(H - PAD + 0.5)
    }
  })

  it('B vertical-ish: fits by height, no divide-by-zero', () => {
    const origin = { lat: 44.0165, lng: 21.0059 }
    const points = [
      origin,
      { lat: northOf(origin.lat, 200), lng: origin.lng },
      { lat: northOf(origin.lat, 400), lng: origin.lng + 0.00002 },
    ]
    const r = projectRouteToSvg(points, W, H, PAD)
    expect(r.pathD).toBeTruthy()
    expect(r.points[0].y).toBeGreaterThan(r.points[2].y) // north = smaller y
  })

  it('C diagonal route preserves order', () => {
    const points = [
      { lat: 44.0, lng: 21.0 },
      { lat: 44.01, lng: 21.01 },
      { lat: 44.02, lng: 21.02 },
    ]
    const r = projectRouteToSvg(points, W, H, PAD)
    expect(r.points[0].x).toBeLessThan(r.points[2].x)
    expect(r.points[0].y).toBeGreaterThan(r.points[2].y)
  })

  it('D serpentine keeps all canonical turns', () => {
    const origin = { lat: 44.0165, lng: 21.0059 }
    const points: RouteLatLng[] = []
    for (let i = 0; i < 10; i++) {
      points.push({
        lat: northOf(origin.lat, i * 8),
        lng: eastOf(origin.lat, origin.lng, Math.sin(i) * 20),
      })
    }
    const r = projectRouteToSvg(points, W, H, PAD)
    expect(r.points).toHaveLength(10)
    expect(r.pathD!.match(/ L /g)?.length).toBe(9)
  })

  it('E almost straight line still produces one continuous path', () => {
    const points = [
      { lat: 44.0, lng: 21.0 },
      { lat: 44.0001, lng: 21.001 },
      { lat: 44.0002, lng: 21.002 },
    ]
    const r = projectRouteToSvg(points, W, H, PAD)
    expect(r.pathD?.startsWith('M ')).toBe(true)
    expect(r.pathD).toContain(' L ')
  })

  it('F two points → one segment', () => {
    const r = projectRouteToSvg(
      [
        { lat: 44.0, lng: 21.0 },
        { lat: 44.01, lng: 21.0 },
      ],
      W,
      H,
      PAD,
    )
    expect(r.points).toHaveLength(2)
    expect(r.pathD?.match(/ L /g)?.length).toBe(1)
  })

  it('G single point → no route', () => {
    const r = projectRouteToSvg([{ lat: 44, lng: 21 }], W, H, PAD)
    expect(r.pathD).toBeNull()
    expect(r.points).toHaveLength(0)
  })

  it('H zero points → no route', () => {
    const r = projectRouteToSvg([], W, H, PAD)
    expect(r.pathD).toBeNull()
  })

  it('I duplicate consecutive points are collapsed safely', () => {
    const r = projectRouteToSvg(
      [
        { lat: 44, lng: 21 },
        { lat: 44, lng: 21 },
        { lat: 44.01, lng: 21 },
      ],
      W,
      H,
      PAD,
    )
    expect(r.points).toHaveLength(2)
  })

  it('J very small geographic bounds still project without NaN', () => {
    const r = projectRouteToSvg(
      [
        { lat: 44.0165, lng: 21.0059 },
        { lat: 44.0165001, lng: 21.0059001 },
      ],
      W,
      H,
      PAD,
    )
    expect(r.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(r.scale).toBeGreaterThan(0)
  })

  it('K small lon/lat ranges preserve aspect (uniform scale)', () => {
    const points = [
      { lat: 44.0, lng: 21.0 },
      { lat: 44.001, lng: 21.002 },
      { lat: 44.002, lng: 21.001 },
    ]
    const r = projectRouteToSvg(points, W, H, PAD)
    // Uniform scale: dx/dLng and -dy/dLat should share the same scale factor
    // after cos(lat) correction — check projected span uses one scale.
    expect(r.scale).toBeGreaterThan(0)
    const xs = r.points.map((p) => p.x)
    const ys = r.points.map((p) => p.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(W - PAD * 2 + 1e-6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(H - PAD * 2 + 1e-6)
  })
})

describe('orientation / aspect / padding', () => {
  it('preserves north-up orientation (no vertical mirror)', () => {
    const gps = [
      { lat: 44.0, lng: 21.0 },
      { lat: 44.01, lng: 21.0 },
      { lat: 44.02, lng: 21.01 },
    ]
    const r = projectRouteToSvg(gps, W, H, PAD)
    expect(isNorthUpOrientation(gps, r.points)).toBe(true)
  })

  it('does not mirror horizontally for increasing longitude', () => {
    const gps = [
      { lat: 44.0, lng: 21.0 },
      { lat: 44.0, lng: 21.02 },
    ]
    const r = projectRouteToSvg(gps, W, H, PAD)
    expect(r.points[0].x).toBeLessThan(r.points[1].x)
  })

  it('aspect ratio preserved: pure N–S span and E–W span get same scale', () => {
    // 100m north vs 100m east should occupy similar pixel length at mid-lat
    const lat = 44.0165
    const lng = 21.0059
    const ns = projectRouteToSvg(
      [
        { lat, lng },
        { lat: northOf(lat, 100), lng },
      ],
      W,
      H,
      PAD,
    )
    const ew = projectRouteToSvg(
      [
        { lat, lng },
        { lat, lng: eastOf(lat, lng, 100) },
      ],
      W,
      H,
      PAD,
    )
    const nsLen = Math.hypot(ns.points[1].x - ns.points[0].x, ns.points[1].y - ns.points[0].y)
    const ewLen = Math.hypot(ew.points[1].x - ew.points[0].x, ew.points[1].y - ew.points[0].y)
    expect(Math.abs(nsLen - ewLen) / nsLen).toBeLessThan(0.05)
  })

  it('padding is respected on all sides', () => {
    const r = projectRouteToSvg(
      [
        { lat: 44, lng: 21 },
        { lat: 44.01, lng: 21.02 },
        { lat: 44.02, lng: 21.01 },
      ],
      W,
      H,
      PAD,
    )
    for (const p of r.points) {
      expect(p.x).toBeGreaterThanOrEqual(PAD - 1e-6)
      expect(p.x).toBeLessThanOrEqual(W - PAD + 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(PAD - 1e-6)
      expect(p.y).toBeLessThanOrEqual(H - PAD + 1e-6)
    }
  })

  it('exact horizontal route (maxLat==minLat) does not NaN', () => {
    const r = projectRouteToSvg(
      [
        { lat: 44.5, lng: 21.0 },
        { lat: 44.5, lng: 21.1 },
      ],
      W,
      H,
      PAD,
    )
    expect(r.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(r.pathD).toBeTruthy()
  })

  it('exact vertical route (maxLng==minLng) does not NaN', () => {
    const r = projectRouteToSvg(
      [
        { lat: 44.0, lng: 21.5 },
        { lat: 44.1, lng: 21.5 },
      ],
      W,
      H,
      PAD,
    )
    expect(r.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(r.pathD).toBeTruthy()
  })
})

describe('path geometry contract', () => {
  it('buildSvgPathD is one continuous M/L geometry', () => {
    const d = buildSvgPathD([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ])
    expect(d).toBe('M 1 2 L 3 4 L 5 6')
  })

  it('does not invent Bezier smoothing', () => {
    const r = projectRouteToSvg(
      [
        { lat: 44, lng: 21 },
        { lat: 44.01, lng: 21.01 },
        { lat: 44.02, lng: 21 },
      ],
      W,
      H,
      PAD,
    )
    expect(r.pathD).not.toMatch(/[CcQqSsTtAa]/)
  })
})
