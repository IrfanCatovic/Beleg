/**
 * Local equirectangular projection for short hiking routes on Adventure sticker.
 *
 * Longitude is scaled by cos(mean latitude) so east–west meters match north–south
 * on the canvas (avoids latitude stretch that would squash/elongate the path).
 * This is NOT a map-tile / WebMercator tile system — only a canvas fit for small
 * GPS polylines.
 *
 * Screen Y increases downward, so latitude is inverted: geographic north stays up.
 */

export interface RouteLatLng {
  lat: number
  lng: number
}

export interface SvgPoint {
  x: number
  y: number
}

export interface ProjectRouteToSvgResult {
  /** Projected SVG coordinates in draw order (empty if no drawable route). */
  points: SvgPoint[]
  /** SVG Path `d` for a continuous polyline, or null when < 2 points. */
  pathD: string | null
  /** Geographic bounds after sanitization. */
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null
  /** Uniform scale applied to both axes (aspect preserved). */
  scale: number
}

const EPS = 1e-9

export function sanitizeRoutePoints(points: ReadonlyArray<RouteLatLng>): RouteLatLng[] {
  const out: RouteLatLng[] = []
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) continue
    const prev = out[out.length - 1]
    if (prev && prev.lat === p.lat && prev.lng === p.lng) continue
    out.push({ lat: p.lat, lng: p.lng })
  }
  return out
}

export function buildSvgPathD(points: ReadonlyArray<SvgPoint>): string | null {
  if (points.length < 2) return null
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`
  }
  return d
}

/**
 * Projects GPS lat/lng into SVG pixel space.
 *
 * @param padding absolute inset in px (applied on all sides). Aspect is preserved;
 *                the route is centered in the remaining inner box.
 */
export function projectRouteToSvg(
  points: ReadonlyArray<RouteLatLng>,
  width: number,
  height: number,
  padding: number,
): ProjectRouteToSvgResult {
  const clean = sanitizeRoutePoints(points)
  if (clean.length < 2 || width <= 0 || height <= 0) {
    return { points: [], pathD: null, bounds: null, scale: 0 }
  }

  const pad = Math.max(0, Math.min(padding, width / 2 - EPS, height / 2 - EPS))
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  if (innerW <= 0 || innerH <= 0) {
    return { points: [], pathD: null, bounds: null, scale: 0 }
  }

  const minLat = Math.min(...clean.map((p) => p.lat))
  const maxLat = Math.max(...clean.map((p) => p.lat))
  const minLng = Math.min(...clean.map((p) => p.lng))
  const maxLng = Math.max(...clean.map((p) => p.lng))

  const lat0 = (minLat + maxLat) / 2
  const k = Math.cos((lat0 * Math.PI) / 180) || 1

  const xs = clean.map((p) => p.lng * k)
  const ys = clean.map((p) => p.lat)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  // Degenerate (straight E–W or N–S): avoid divide-by-zero; keep aspect by
  // using a tiny span so scale still comes from the non-zero axis.
  let spanX = maxX - minX
  let spanY = maxY - minY
  if (spanX < EPS && spanY < EPS) {
    spanX = EPS
    spanY = EPS
  } else if (spanX < EPS) {
    spanX = spanY
  } else if (spanY < EPS) {
    spanY = spanX
  }

  const scale = Math.min(innerW / spanX, innerH / spanY)
  const drawW = spanX * scale
  const drawH = spanY * scale
  const offsetX = pad + (innerW - drawW) / 2
  const offsetY = pad + (innerH - drawH) / 2

  const projected: SvgPoint[] = clean.map((p) => ({
    x: offsetX + (p.lng * k - minX) * scale,
    // Invert latitude so north is up (SVG Y grows downward).
    y: offsetY + (maxY - p.lat) * scale,
  }))

  return {
    points: projected,
    pathD: buildSvgPathD(projected),
    bounds: { minLat, maxLat, minLng, maxLng },
    scale,
  }
}

/** True when every consecutive projected turn matches canonical GPS order (no reverse). */
export function isNorthUpOrientation(
  gps: ReadonlyArray<RouteLatLng>,
  projected: ReadonlyArray<SvgPoint>,
): boolean {
  if (gps.length < 2 || gps.length !== projected.length) return false
  // Among points that differ in latitude, higher lat must have smaller SVG y.
  for (let i = 0; i < gps.length; i++) {
    for (let j = i + 1; j < gps.length; j++) {
      if (gps[i].lat === gps[j].lat) continue
      if (gps[i].lat > gps[j].lat && !(projected[i].y < projected[j].y)) return false
      if (gps[i].lat < gps[j].lat && !(projected[i].y > projected[j].y)) return false
    }
  }
  return true
}
