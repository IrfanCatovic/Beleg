import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import { formatSteps } from '../services/activityMetrics'

interface Props {
  steps: number
  goal: number
  progressPercent: number
}

export function DailyStepsProgressRing({ steps, goal, progressPercent }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="title" style={styles.steps}>
        {formatSteps(steps)}
      </Text>
      <Text variant="small" color={colors.textMuted}>
        od {formatSteps(goal)} cilja
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, progressPercent)}%` }]} />
      </View>
      <Text variant="label" color={colors.brand}>
        {progressPercent}%
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  steps: { fontSize: 36 },
  track: {
    width: '100%',
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: radius.full,
  },
})
