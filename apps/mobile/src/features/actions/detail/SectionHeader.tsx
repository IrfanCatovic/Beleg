import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface SectionHeaderProps {
  title: string
  count?: number
}

export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.accent} />
      <Text variant="label" style={styles.title}>
        {title}
      </Text>
      {count != null ? (
        <View style={styles.badge}>
          <Text variant="small" color={colors.brand} style={styles.badgeText}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  accent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  title: { flex: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontWeight: '700', fontSize: 11 },
})
