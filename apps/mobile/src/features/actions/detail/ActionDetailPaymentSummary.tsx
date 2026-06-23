import { StyleSheet, View } from 'react-native'
import { Button, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import { SectionHeader } from './SectionHeader'

interface ActionDetailPaymentSummaryProps {
  paidCount: number
  totalCount: number
  paidTotal: number
  expectedTotal: number
  currency: string
  onBulkMarkPaid: () => void
}

export function ActionDetailPaymentSummary({
  paidCount,
  totalCount,
  paidTotal,
  expectedTotal,
  currency,
  onBulkMarkPaid,
}: ActionDetailPaymentSummaryProps) {
  const fmt = (n: number) => `${n.toLocaleString('sr-RS')} ${currency}`

  return (
    <Card style={styles.card}>
      <SectionHeader title="Plaćanja" />
      <View style={styles.row}>
        <Text variant="small" color={colors.textMuted}>
          Plaćeno članova
        </Text>
        <Text variant="label">
          {paidCount} / {totalCount}
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="small" color={colors.textMuted}>
          Prihod (plaćeni)
        </Text>
        <Text variant="label" color={colors.brand}>
          {fmt(paidTotal)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="small" color={colors.textMuted}>
          Očekivano ukupno
        </Text>
        <Text variant="body">{fmt(expectedTotal)}</Text>
      </View>
      <Button title="Označi sve neplaćene" variant="secondary" onPress={onBulkMarkPaid} fullWidth />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
