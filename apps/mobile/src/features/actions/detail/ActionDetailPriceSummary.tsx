import { StyleSheet, View } from 'react-native'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import { SectionHeader } from './SectionHeader'

interface ActionDetailPriceSummaryProps {
  baseCena: number
  smestajTotal: number
  prevozTotal: number
  rentTotal: number
  total: number
  currency: string
  serverSaldo?: number
}

export function ActionDetailPriceSummary({
  baseCena,
  smestajTotal,
  prevozTotal,
  rentTotal,
  total,
  currency,
  serverSaldo,
}: ActionDetailPriceSummaryProps) {
  if (total <= 0 && baseCena <= 0) return null

  const fmt = (n: number) => `${n.toLocaleString('sr-RS')} ${currency}`

  return (
    <Card style={styles.card}>
      <SectionHeader title="Pregled cene" />
      {baseCena > 0 ? <Row label="Cena" value={fmt(baseCena)} /> : null}
      {smestajTotal > 0 ? <Row label="Smeštaj" value={fmt(smestajTotal)} /> : null}
      {prevozTotal > 0 ? <Row label="Prevoz" value={fmt(prevozTotal)} /> : null}
      {rentTotal > 0 ? <Row label="Oprema" value={fmt(rentTotal)} /> : null}
      <View style={styles.totalRow}>
        <Text variant="label">Ukupno</Text>
        <Text variant="label" color={colors.brand}>
          {fmt(total)}
        </Text>
      </View>
      {serverSaldo != null && Math.abs(serverSaldo - total) > 0.01 ? (
        <Text variant="small" color={colors.textMuted} style={styles.hint}>
          Server: {fmt(serverSaldo)}
        </Text>
      ) : null}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { marginTop: 4 },
})
