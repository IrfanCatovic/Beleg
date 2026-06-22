import { StyleSheet, View } from 'react-native'
import { Button, Text } from '../ui'
import { colors, radius, spacing } from '../../theme'

export function MapStyleMissing({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={styles.root}>
      <Text variant="heading" style={styles.title}>
        Mapa nije konfigurisana
      </Text>
      <Text color={colors.textMuted} style={styles.body}>
        Dodaj EXPO_PUBLIC_MAPTILER_API_KEY u .env (isti ključ kao VITE_MAPTILER_API_KEY na webu) ili pun URL u
        EXPO_PUBLIC_MAP_STYLE_URL. Besplatan nalog na maptiler.com.
      </Text>
      {onRetry ? <Button title="Pokušaj ponovo" variant="secondary" onPress={onRetry} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', lineHeight: 22 },
})
