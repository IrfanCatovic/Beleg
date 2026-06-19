import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { colors, spacing } from '../../theme'

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
      {label ? <Text variant="muted" style={{ marginTop: spacing.md }}>{label}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
})
