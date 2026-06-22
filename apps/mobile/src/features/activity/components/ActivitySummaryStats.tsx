import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import {
  formatDistanceKm,
  formatDuration,
  formatSteps,
} from '../services/activityMetrics'

interface Props {
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
}

export function ActivitySummaryStats({ durationSec, distanceM, elevationGainM, steps }: Props) {
  const items = [
    { label: 'Trajanje', value: formatDuration(durationSec) },
    { label: 'Udaljenost', value: formatDistanceKm(distanceM) },
    { label: 'Procijenjeni uspon', value: `${Math.round(elevationGainM)} m` },
    { label: 'Koraci', value: formatSteps(steps) },
  ]

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.card}>
          <Text variant="small" color={colors.textMuted}>
            {item.label}
          </Text>
          <Text variant="label">{item.value}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: '47%',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
})
