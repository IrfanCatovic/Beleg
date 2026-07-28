import { StyleSheet } from 'react-native'
import { Button, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface Props {
  onSharePress: () => void
}

export function ActionDetailSummitCard({ onSharePress }: Props) {
  return (
    <Card style={styles.card}>
      <Text variant="label">Preuzmi sliku uspeha</Text>
      <Text variant="small" color={colors.textMuted} style={styles.desc}>
        Kreiraj i podeli sliku svog uspešnog uspona.
      </Text>
      <Button title="Podeli" onPress={onSharePress} fullWidth />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  desc: {
    marginBottom: spacing.xs,
  },
})
