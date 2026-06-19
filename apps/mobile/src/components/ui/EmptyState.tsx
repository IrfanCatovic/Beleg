import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from './Text'
import { Button } from './Button'
import { colors, spacing } from '../../theme'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon = 'documents-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={48} color={colors.textSubtle} />
      <Text variant="heading" style={styles.title}>{title}</Text>
      {message ? <Text variant="muted" style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  title: { marginTop: spacing.md, textAlign: 'center' },
  message: { textAlign: 'center', marginBottom: spacing.md },
})
