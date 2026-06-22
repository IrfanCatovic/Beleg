import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import {
  formatDistanceKm,
  formatDuration,
  formatSteps,
} from '../services/activityMetrics'

interface Props {
  elapsedSec: number
  distanceM: number
  elevationGainM: number
  steps: number
}

export function ActivityLiveStatsBar({ elapsedSec, distanceM, elevationGainM, steps }: Props) {
  const items = [
    { label: 'Vrijeme', value: formatDuration(elapsedSec) },
    { label: 'Udaljenost', value: formatDistanceKm(distanceM) },
    { label: 'Uspon', value: `${Math.round(elevationGainM)} m` },
    { label: 'Koraci', value: formatSteps(steps) },
  ]

  return (
    <View style={styles.bar}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
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
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    minWidth: '40%',
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
})
