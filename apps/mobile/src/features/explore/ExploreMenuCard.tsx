import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'

interface Props {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  hint: string
  onPress: () => void
}

export function ExploreMenuCard({ icon, title, hint, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={24} color={colors.brand} />
      </View>
      <View style={styles.cardBody}>
        <Text variant="label">{title}</Text>
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
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
  cardBody: { flex: 1, gap: 2 },
})
