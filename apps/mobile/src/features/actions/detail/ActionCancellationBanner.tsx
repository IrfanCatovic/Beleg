import { StyleSheet, View } from 'react-native'
import {
  formatActionCancelledAt,
  getCancellationReasonDisplay,
  isActionCancelled,
  type AkcijaDetail,
} from '@beleg/shared'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

type CancellationAction = Pick<
  AkcijaDetail,
  'isCancelled' | 'cancelledAt' | 'cancellationReason'
>

export function ActionCancellationBanner({ akcija }: { akcija: CancellationAction }) {
  if (!isActionCancelled(akcija)) return null

  const reason = getCancellationReasonDisplay(akcija.cancellationReason)
  const cancelledAtLabel = formatActionCancelledAt(akcija.cancelledAt)

  return (
    <Card style={styles.card}>
      <Text variant="label" color={colors.danger} style={styles.title}>
        Akcija je otkazana
      </Text>
      <View style={styles.body}>
        <Text variant="small" color={colors.text}>
          <Text variant="small" style={styles.bold}>
            Razlog:{' '}
          </Text>
          {reason}
        </Text>
        {cancelledAtLabel ? (
          <Text variant="small" color={colors.text}>
            <Text variant="small" style={styles.bold}>
              Otkazano:{' '}
            </Text>
            {cancelledAtLabel}
          </Text>
        ) : null}
      </View>
      <Text variant="small" color={colors.textMuted} style={styles.note}>
        Evidentirane uplate nisu automatski refundirane.
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    borderColor: colors.dangerBg,
    backgroundColor: '#fff1f2',
    gap: spacing.sm,
  },
  title: { textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { gap: 4 },
  bold: { fontWeight: '700' },
  note: { marginTop: 2 },
})
