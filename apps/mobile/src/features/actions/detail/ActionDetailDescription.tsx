import { StyleSheet, View } from 'react-native'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import { SectionHeader } from './SectionHeader'

interface ActionDetailDescriptionProps {
  opis?: string
}

export function ActionDetailDescription({ opis }: ActionDetailDescriptionProps) {
  if (!opis?.trim()) return null

  return (
    <Card style={styles.card}>
      <SectionHeader title="Opis akcije" />
      <View style={styles.body}>
        <View style={styles.accent} />
        <Text variant="body" color={colors.textMuted} style={styles.text}>
          {opis.trim()}
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  body: { flexDirection: 'row', gap: spacing.sm },
  accent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.brand,
    alignSelf: 'stretch',
  },
  text: { flex: 1, lineHeight: 22 },
})
