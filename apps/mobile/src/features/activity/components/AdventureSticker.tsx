import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import {
  formatDistanceKm,
  formatDuration,
  formatSteps,
} from '../services/activityMetrics'

export const ADVENTURE_STICKER_WIDTH = 270
export const ADVENTURE_STICKER_HEIGHT = 480

interface Props {
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
  dateLabel: string
}

export function AdventureSticker({
  durationSec,
  distanceM,
  elevationGainM,
  steps,
  dateLabel,
}: Props) {
  const cells = [
    { label: 'Trajanje', value: formatDuration(durationSec) },
    { label: 'Udaljenost', value: formatDistanceKm(distanceM) },
    { label: 'Uspon', value: `${Math.round(elevationGainM)} m` },
    { label: 'Koraci', value: formatSteps(steps) },
  ]

  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <Text style={styles.kicker}>AVANTURA</Text>
        <Text style={styles.date}>{dateLabel}</Text>

        <View style={styles.grid}>
          {cells.map((cell) => (
            <View key={cell.label} style={styles.cell}>
              <Text style={styles.cellLabel}>{cell.label.toUpperCase()}</Text>
              <Text style={styles.cellValue}>{cell.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.brandWrap}>
          <Text style={styles.brand}>PLANINER</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: ADVENTURE_STICKER_WIDTH,
    height: ADVENTURE_STICKER_HEIGHT,
    backgroundColor: '#0f172a',
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xl,
  },
  kicker: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  date: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  cell: {
    width: '46%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  cellLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  cellValue: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  brandWrap: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  brand: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
})
