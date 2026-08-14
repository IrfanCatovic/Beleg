import type { GPSPoint } from '@beleg/shared'

export type LngLat = [number, number]

export function gpsPointsToLngLat(points: Array<{ lat: number; lng: number }>): LngLat[] {
  return points.map((p) => [p.lng, p.lat])
}

export function buildLiveRouteLineString(points: Array<{ lat: number; lng: number }>): {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: LngLat[] }
  properties: Record<string, never>
} | null {
  if (points.length < 2) return null
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: gpsPointsToLngLat(points),
    },
    properties: {},
  }
}

export function shouldUpdateFollowCamera(opts: {
  lastFollowAtMs: number | null
  lastFollowLngLat: LngLat | null
  nextLngLat: LngLat
  nowMs: number
  minIntervalMs?: number
  minDistanceM?: number
}): boolean {
  const minIntervalMs = opts.minIntervalMs ?? 4000
  const minDistanceM = opts.minDistanceM ?? 20
  if (opts.lastFollowLngLat == null || opts.lastFollowAtMs == null) return true
  if (opts.nowMs - opts.lastFollowAtMs >= minIntervalMs) return true
  const [lng0, lat0] = opts.lastFollowLngLat
  const [lng1, lat1] = opts.nextLngLat
  const dLat = ((lat1 - lat0) * Math.PI) / 180
  const dLng = ((lng1 - lng0) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat0 * Math.PI) / 180) * Math.cos((lat1 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const meters = 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)))
  return meters >= minDistanceM
}

export function canonicalAcceptedPoints(points: GPSPoint[]): GPSPoint[] {
  const sorted = [...points].sort((a, b) => {
    const ta = new Date(a.recordedAt).getTime()
    const tb = new Date(b.recordedAt).getTime()
    return ta - tb
  })
  const out: GPSPoint[] = []
  for (const p of sorted) {
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.lat === p.lat &&
      prev.lng === p.lng &&
      prev.recordedAt === p.recordedAt
    ) {
      continue
    }
    out.push(p)
  }
  return out
}
