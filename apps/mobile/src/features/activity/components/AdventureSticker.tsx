import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import type { LatLngAlt } from '../services/activityMetrics'
import {
  formatDistanceKm,
  formatDuration,
  formatSteps,
} from '../services/activityMetrics'

export const ADVENTURE_STICKER_WIDTH = 270
export const ADVENTURE_STICKER_HEIGHT = 400

const ROUTE_BOX_W = 220
const ROUTE_BOX_H = 118
const ROUTE_PAD = 12
const ROUTE_DOT = 3
const ROUTE_GAP = 4 // px spacing between interpolated dots
const ROUTE_MAX_DOTS = 600

interface Props {
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
  routePoints?: LatLngAlt[]
  /** Kept for API compatibility; no longer rendered on the sticker. */
  dateLabel?: string
}

/**
 * Projects GPS points into the route box, preserving shape (longitude scaled by
 * cos(lat) to correct aspect). Returns pixel positions inside the box.
 */
function projectRoute(points: LatLngAlt[]): { x: number; y: number }[] {
  if (points.length < 2) return []
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length
  const k = Math.cos((lat0 * Math.PI) / 180) || 1
  const xs = points.map((p) => p.lng * k)
  const ys = points.map((p) => p.lat)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanY = Math.max(maxY - minY, 1e-6)
  const innerW = ROUTE_BOX_W - ROUTE_PAD * 2
  const innerH = ROUTE_BOX_H - ROUTE_PAD * 2
  const scale = Math.min(innerW / spanX, innerH / spanY)
  const drawW = spanX * scale
  const drawH = spanY * scale
  const offsetX = ROUTE_PAD + (innerW - drawW) / 2
  const offsetY = ROUTE_PAD + (innerH - drawH) / 2
  return points.map((p) => ({
    x: offsetX + (p.lng * k - minX) * scale,
    // invert Y so north is up
    y: offsetY + (maxY - p.lat) * scale,
  }))
}

/** Builds dot positions along the route so it reads as a continuous line. */
function routeDots(points: LatLngAlt[]): { x: number; y: number }[] {
  const projected = projectRoute(points)
  if (projected.length < 2) return []
  const dots: { x: number; y: number }[] = []
  for (let i = 1; i < projected.length; i++) {
    const a = projected[i - 1]
    const b = projected[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy)
    const steps = Math.max(1, Math.round(dist / ROUTE_GAP))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      dots.push({ x: a.x + dx * t, y: a.y + dy * t })
    }
    if (dots.length >= ROUTE_MAX_DOTS) break
  }
  dots.push(projected[projected.length - 1])
  return dots
}

export function AdventureSticker({
  durationSec,
  distanceM,
  elevationGainM,
  steps,
  routePoints,
}: Props) {
  const cells = [
    { label: 'Trajanje', value: formatDuration(durationSec) },
    { label: 'Udaljenost', value: formatDistanceKm(distanceM) },
    { label: 'Uspon', value: `${Math.round(elevationGainM)} m` },
    { label: 'Koraci', value: formatSteps(steps) },
  ]

  const dots = routePoints ? routeDots(routePoints) : []

  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <View style={styles.grid}>
          {cells.map((cell) => (
            <View key={cell.label} style={styles.cell}>
              <Text style={styles.cellLabel}>{cell.label.toUpperCase()}</Text>
              <Text style={styles.cellValue}>{cell.value}</Text>
            </View>
          ))}
        </View>

        {dots.length > 0 ? (
          <View style={styles.routeBox}>
            {dots.map((d, i) => (
              <View
                key={i}
                style={[styles.routeDot, { left: d.x - ROUTE_DOT / 2, top: d.y - ROUTE_DOT / 2 }]}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.brandWrap}>
          <Text style={styles.brand}>PLANINER</Text>
        </View>
      </View>
    </View>
  )
}

const TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const

const styles = StyleSheet.create({
  root: {
    width: ADVENTURE_STICKER_WIDTH,
    height: ADVENTURE_STICKER_HEIGHT,
    backgroundColor: 'transparent',
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 6,
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  cell: {
    width: 115,
    alignItems: 'center',
    paddingVertical: 2,
    gap: 1,
  },
  cellLabel: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 13,
    marginBottom: 1,
    ...TEXT_SHADOW,
  },
  cellValue: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    ...TEXT_SHADOW,
  },
  routeBox: {
    width: ROUTE_BOX_W,
    height: ROUTE_BOX_H,
    alignSelf: 'center',
    marginTop: 2,
  },
  routeDot: {
    position: 'absolute',
    width: ROUTE_DOT,
    height: ROUTE_DOT,
    borderRadius: ROUTE_DOT / 2,
    backgroundColor: colors.brand,
  },
  brandWrap: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  brand: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    ...TEXT_SHADOW,
  },
})
