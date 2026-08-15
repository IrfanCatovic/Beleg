import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import type { LatLngAlt } from '../services/activityMetrics'
import {
  formatDistanceKm,
  formatDuration,
  formatSteps,
} from '../services/activityMetrics'
import { AdventureRouteSvg } from './AdventureRouteSvg'

export const ADVENTURE_STICKER_WIDTH = 270
export const ADVENTURE_STICKER_HEIGHT = 400

interface Props {
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
  /** Canonical decoded final routePolyline points (lat/lng). */
  routePoints?: LatLngAlt[]
  /** Kept for API compatibility; no longer rendered on the sticker. */
  dateLabel?: string
}

/**
 * Adventure share sticker. Route is a continuous SVG Path (not View dots).
 * Root stays transparent for PNG alpha capture via react-native-view-shot.
 */
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

  const hasRoute = (routePoints?.length ?? 0) >= 2

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

        {hasRoute && routePoints ? (
          <View style={styles.routeBox}>
            <AdventureRouteSvg points={routePoints} />
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
    alignSelf: 'center',
    marginTop: 2,
    backgroundColor: 'transparent',
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
