import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'

interface ProfileActionsToggleProps {
  tab: 'climbed' | 'guided'
  climbedCount: number
  guidedCount: number
  onChange: (tab: 'climbed' | 'guided') => void
}

export function ProfileActionsToggle({
  tab,
  climbedCount,
  guidedCount,
  onChange,
}: ProfileActionsToggleProps) {
  const isClimbed = tab === 'climbed'

  return (
    <View style={styles.wrap}>
      <View style={[styles.slider, isClimbed ? styles.sliderLeft : styles.sliderRight]} />
      <Pressable style={styles.tab} onPress={() => onChange('climbed')}>
        <Text variant="label" color={isClimbed ? '#065f46' : colors.textMuted}>
          Osvojene
        </Text>
        <View style={[styles.badge, isClimbed ? styles.badgeActive : styles.badgeIdle]}>
          <Text variant="small" color={isClimbed ? colors.white : colors.textMuted}>
            {climbedCount}
          </Text>
        </View>
      </Pressable>
      <View style={styles.divider} />
      <Pressable style={styles.tab} onPress={() => onChange('guided')}>
        <Text variant="label" color={!isClimbed ? '#5b21b6' : colors.textMuted}>
          Vođene ture
        </Text>
        <View style={[styles.badge, !isClimbed ? styles.badgeGuided : styles.badgeIdle]}>
          <Text variant="small" color={!isClimbed ? colors.white : colors.textMuted}>
            {guidedCount}
          </Text>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 4,
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  slider: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '48%',
    borderRadius: radius.lg,
  },
  sliderLeft: { left: 4, backgroundColor: '#ecfdf5' },
  sliderRight: { right: 4, backgroundColor: '#f5f3ff' },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 4,
    zIndex: 1,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
  },
  badgeActive: { backgroundColor: colors.brand },
  badgeGuided: { backgroundColor: '#7c3aed' },
  badgeIdle: { backgroundColor: colors.surfaceAlt },
})
