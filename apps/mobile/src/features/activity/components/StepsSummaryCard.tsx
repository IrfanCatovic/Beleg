import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import { formatSteps } from '../services/activityMetrics'

interface Props {
  steps: number
  goal: number
  progressPercent: number
  loading?: boolean
  unavailable?: boolean
  onPress: () => void
}

export function StepsSummaryCard({
  steps,
  goal,
  progressPercent,
  loading = false,
  unavailable = false,
  onPress,
}: Props) {
  const subtitle = loading
    ? 'Učitavanje koraka...'
    : unavailable
      ? 'Brojač nije dostupan na uređaju'
      : `${formatSteps(steps)} / ${formatSteps(goal)}`

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="footsteps-outline" size={24} color={colors.brand} />
      </View>
      <View style={styles.body}>
        <Text variant="label">Dnevni koraci</Text>
        <Text variant="small" color={colors.textMuted}>
          {subtitle}
        </Text>
        {!loading && !unavailable ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, progressPercent)}%` }]} />
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  body: { flex: 1, gap: 2 },
  track: {
    marginTop: spacing.xs,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: radius.full,
  },
})
