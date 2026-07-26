import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'

interface SettingsSectionProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  badge?: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ icon, title, badge, description, children }: SettingsSectionProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header} accessibilityRole="header">
        <Ionicons name={icon} size={18} color={colors.brand} />
        <Text variant="label">{title}</Text>
        {badge ? (
          <View style={styles.badge} accessibilityLabel={`Oznaka privatnosti: ${badge}`} accessible>
            <Text variant="small" color={colors.textMuted} style={styles.badgeText}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {description ? (
        <Text variant="small" color={colors.textMuted}>
          {description}
        </Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { gap: spacing.md },
})
