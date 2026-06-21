import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'

interface SettingsSectionProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  children: ReactNode
}

export function SettingsSection({ icon, title, children }: SettingsSectionProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name={icon} size={18} color={colors.brand} />
        <Text variant="label">{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { gap: spacing.md },
})
