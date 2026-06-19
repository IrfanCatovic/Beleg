import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from './Text'
import { Button } from './Button'
import { colors, spacing } from '../../theme'

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
      <Text variant="muted" style={styles.message}>
        {message ?? 'Došlo je do greške.'}
      </Text>
      {onRetry ? <Button title="Pokušaj ponovo" variant="secondary" onPress={onRetry} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  message: { textAlign: 'center' },
})
