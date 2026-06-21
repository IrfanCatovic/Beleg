import { StyleSheet, View } from 'react-native'
import type { AkcijaDetail } from '@beleg/shared'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailPriceSummaryProps {
  akcija: AkcijaDetail
  smestajTotal: number
  prevozTotal: number
  rentTotal: number
}

export function ActionDetailPriceSummary({
  akcija,
  smestajTotal,
  prevozTotal,
  rentTotal,
}: ActionDetailPriceSummaryProps) {
  const base = akcija.isClanKluba ? akcija.cenaClan : akcija.cenaOstali
  const basePrice = typeof base === 'number' ? base : 0
  const total = basePrice + smestajTotal + prevozTotal + rentTotal

  if (total <= 0 && basePrice <= 0) return null

  return (
    <Card style={styles.card}>
      <Text variant="label">Cena</Text>
      {basePrice > 0 ? (
        <Row label="Osnovna cena" value={`${basePrice.toLocaleString('sr-RS')} RSD`} />
      ) : null}
      {smestajTotal > 0 ? (
        <Row label="Smeštaj" value={`${smestajTotal.toLocaleString('sr-RS')} RSD`} />
      ) : null}
      {prevozTotal > 0 ? (
        <Row label="Prevoz" value={`${prevozTotal.toLocaleString('sr-RS')} RSD`} />
      ) : null}
      {rentTotal > 0 ? (
        <Row label="Oprema" value={`${rentTotal.toLocaleString('sr-RS')} RSD`} />
      ) : null}
      <View style={styles.totalRow}>
        <Text variant="label">Ukupno</Text>
        <Text variant="label" color={colors.brand}>
          {total.toLocaleString('sr-RS')} RSD
        </Text>
      </View>
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
  card: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
