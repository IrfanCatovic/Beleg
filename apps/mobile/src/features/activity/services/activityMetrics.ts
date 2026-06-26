const EARTH_RADIUS_M = 6371000
const ELEVATION_THRESHOLD_M = 3

export interface LatLngAlt {
  lat: number
  lng: number
  altitude?: number
}

export function haversineDistanceM(a: LatLngAlt, b: LatLngAlt): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function sumRouteDistanceM(points: LatLngAlt[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceM(points[i - 1], points[i])
  }
  return total
}

export function computeElevationGainM(points: LatLngAlt[]): number {
  let gain = 0
  let skippedMissingAlt = 0
  let skippedBelowThreshold = 0
  let countedSegments = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].altitude
    const curr = points[i].altitude
    if (prev == null || curr == null) {
      skippedMissingAlt++
      continue
    }
    const delta = curr - prev
    if (delta >= ELEVATION_THRESHOLD_M) {
      gain += delta
      countedSegments++
    } else if (delta > 0) {
      skippedBelowThreshold++
    }
  }
  const withAlt = points.filter((p) => p.altitude != null).length
  // #region agent log
  if (points.length >= 2) {
    fetch('http://127.0.0.1:7774/ingest/4b4823e8-e059-45d4-bd4e-f7b6e10474eb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6cb8dd' },
      body: JSON.stringify({
        sessionId: '6cb8dd',
        runId: 'pre-fix',
        hypothesisId: 'A-B-C',
        location: 'activityMetrics.ts:computeElevationGainM',
        message: 'elevation gain computed',
        data: {
          totalPoints: points.length,
          withAltitude: withAlt,
          skippedMissingAlt,
          skippedBelowThreshold,
          countedSegments,
          gainM: Math.round(gain * 10) / 10,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }
  // #endregion
  return gain
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDistanceKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export function formatSteps(n: number): string {
  return n.toLocaleString('sr-RS')
}

/** Google encoded polyline (precision 5). */
export function encodePolyline(points: LatLngAlt[]): string {
  let lastLat = 0
  let lastLng = 0
  let result = ''
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5)
    const lng = Math.round(p.lng * 1e5)
    result += encodeSigned(lat - lastLat)
    result += encodeSigned(lng - lastLng)
    lastLat = lat
    lastLng = lng
  }
  return result
}

function encodeSigned(num: number): string {
  let s = num << 1
  if (num < 0) s = ~s
  let chunk = ''
  while (s >= 0x20) {
    chunk += String.fromCharCode((0x20 | (s & 0x1f)) + 63)
    s >>= 5
  }
  chunk += String.fromCharCode(s + 63)
  return chunk
}

/** Decode polyline for summary map display. */
export function decodePolyline(encoded: string): LatLngAlt[] {
  const points: LatLngAlt[] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
  let b: number
  let shift = 0
  let result = 0
  do {
    b = encoded.charCodeAt(index++) - 63
    result |= (b & 0x1f) << shift
    shift += 5
  } while (b >= 0x20)
  const dlat = result & 1 ? ~(result >> 1) : result >> 1
  lat += dlat
  shift = 0
  result = 0
  do {
    b = encoded.charCodeAt(index++) - 63
    result |= (b & 0x1f) << shift
    shift += 5
  } while (b >= 0x20)
  const dlng = result & 1 ? ~(result >> 1) : result >> 1
  lng += dlng
  points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}
