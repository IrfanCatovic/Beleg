import { Pressable, StyleSheet, View } from 'react-native'
import type { AkcijaListItem } from '@beleg/shared'
import { Badge, Card, Text } from '../ui'
import { colors, spacing } from '../../theme'

interface ActionCardProps {
  action: AkcijaListItem
  onPress?: () => void
  signedUp?: boolean
}

function formatDate(datum?: string) {
  if (!datum) return ''
  return new Date(datum).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ActionCard({ action, onPress, signedUp }: ActionCardProps) {
  const isPast = action.isCompleted

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text variant="label" style={styles.title}>
            {action.naziv}
          </Text>
          {signedUp ? <Badge label="Prijavljen" tone="brand" /> : null}
          {isPast ? <Badge label="Završena" tone="muted" /> : null}
        </View>
        {action.planina ? (
          <Text variant="small" color={colors.textMuted}>
            {action.planina}
            {action.vrh ? ` · ${action.vrh}` : ''}
          </Text>
        ) : null}
        <Text variant="small" color={colors.brand}>
          {formatDate(action.datum)}
        </Text>
        {action.tezina ? (
          <Text variant="small" color={colors.textMuted}>
            Težina: {action.tezina}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  title: { flex: 1 },
})
