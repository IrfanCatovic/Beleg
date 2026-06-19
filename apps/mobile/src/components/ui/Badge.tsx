import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

type Tone = 'brand' | 'muted' | 'warning' | 'danger'

const tones: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: '#ecfdf5', fg: colors.brandDark }, // emerald-50
  muted: { bg: colors.surfaceAlt, fg: colors.textMuted },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: Tone }) {
  const palette = tones[tone]
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.fg, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
})
