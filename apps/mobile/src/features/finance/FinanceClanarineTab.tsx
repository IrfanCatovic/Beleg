import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, ChipRow, Input, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import { clanarineYearOptions } from './financeUtils'

export type ClanarinaRow = {
  id: number
  fullName: string
  username: string
  platio: boolean
}

type FinanceClanarineTabProps = {
  currency: string
  currentYear: number
  clanarineGodina: number
  onChangeGodina: (year: number) => void
  clanarinaIznosDraft: string
  onChangeIznosDraft: (value: string) => void
  clanarinaSaving: boolean
  onPromeniClanarinu: () => void
  clanarine: ClanarinaRow[]
  loading: boolean
  platiLoadingId: number | null
  onPlati: (memberId: number) => void
}

const INFO_TEXT =
  'Status članarine važi po kalendariskoj godini. Za novu godinu svi članovi su početno neplaćeni dok se ne evidentira uplata. Brisanjem uplate članarine na pregledu finansija status se vraća na neplaćeno.'

export function FinanceClanarineTab({
  currency,
  currentYear,
  clanarineGodina,
  onChangeGodina,
  clanarinaIznosDraft,
  onChangeIznosDraft,
  clanarinaSaving,
  onPromeniClanarinu,
  clanarine,
  loading,
  platiLoadingId,
  onPlati,
}: FinanceClanarineTabProps) {
  const yearOptions = clanarineYearOptions(currentYear).map((y) => ({
    value: String(y),
    label: `${y}.`,
  }))

  return (
    <View style={styles.wrap}>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={20} color={colors.brand} />
        <Text variant="small" color={colors.textMuted} style={styles.infoText}>
          {INFO_TEXT}
        </Text>
      </View>

      <Card style={styles.controls}>
        <ChipRow
          label="Godina"
          options={yearOptions}
          value={String(clanarineGodina)}
          onChange={(v) => onChangeGodina(Number(v))}
        />
        <Text variant="label">Iznos članarine ({currency})</Text>
        <View style={styles.amountRow}>
          <Input
            value={clanarinaIznosDraft}
            onChangeText={(v) => onChangeIznosDraft(v.replace(/[^0-9,.]/g, ''))}
            keyboardType="decimal-pad"
            style={styles.amountInput}
          />
          <Button
            title={clanarinaSaving ? '...' : 'Promeni članarinu'}
            variant="secondary"
            onPress={onPromeniClanarinu}
            disabled={clanarinaSaving}
          />
        </View>
      </Card>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : clanarine.length === 0 ? (
        <Text color={colors.textMuted}>Nema podataka o članarinama.</Text>
      ) : (
        clanarine.map((row) => (
          <Card key={row.id} style={styles.rowCard}>
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text variant="label">{row.fullName || row.username}</Text>
                <Text variant="small" color={colors.textMuted}>
                  @{row.username}
                </Text>
              </View>
              {row.platio ? (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
                  <Text variant="label" color={colors.brand}>
                    Plaćeno
                  </Text>
                </View>
              ) : (
                <Button
                  title={platiLoadingId === row.id ? 'Čekaj...' : 'Plati'}
                  variant="secondary"
                  onPress={() => onPlati(row.id)}
                  loading={platiLoadingId === row.id}
                />
              )}
            </View>
          </Card>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: colors.brandLight,
  },
  infoText: { flex: 1, lineHeight: 20 },
  controls: { gap: spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  amountInput: { flex: 1 },
  loader: { marginVertical: spacing.lg },
  rowCard: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowInfo: { flex: 1, gap: 2 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
})
