import { Pressable, StyleSheet, View } from 'react-native'
import type { AkcijaDetail } from '@beleg/shared'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

function SelectionRow({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string
  sub?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
      <Text variant="label">{label}</Text>
      {sub ? (
        <Text variant="small" color={colors.textMuted}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  )
}

interface ActionDetailLogisticsProps {
  akcija: AkcijaDetail
  selSmestaj: Set<number>
  selPrevoz: Set<number>
  selRent: Record<number, number>
  onToggleSmestaj: (id: number) => void
  onSelectPrevoz: (id: number) => void
  onChangeRent: (id: number, delta: number, max: number) => void
}

export function ActionDetailLogistics({
  akcija,
  selSmestaj,
  selPrevoz,
  selRent,
  onToggleSmestaj,
  onSelectPrevoz,
  onChangeRent,
}: ActionDetailLogisticsProps) {
  const smestaj = akcija.smestaj ?? []
  const prevoz = akcija.prevoz ?? []
  const rent = akcija.opremaRent ?? []
  const oprema = akcija.oprema ?? []

  if (smestaj.length === 0 && prevoz.length === 0 && rent.length === 0 && oprema.length === 0) {
    return null
  }

  return (
    <Card style={styles.card}>
      <Text variant="label">Logistika</Text>

      {smestaj.length > 0 ? (
        <View style={styles.section}>
          <Text variant="small" color={colors.textMuted}>
            Smeštaj
          </Text>
          {smestaj.map((s) => (
            <SelectionRow
              key={s.id}
              label={s.naziv}
              sub={`${s.cenaPoOsobiUkupno} RSD`}
              selected={selSmestaj.has(s.id)}
              onPress={() => onToggleSmestaj(s.id)}
            />
          ))}
        </View>
      ) : null}

      {prevoz.length > 0 ? (
        <View style={styles.section}>
          <Text variant="small" color={colors.textMuted}>
            Prevoz
          </Text>
          {prevoz.map((p) => (
            <SelectionRow
              key={p.id}
              label={`${p.nazivGrupe} (${p.tipPrevoza})`}
              sub={`${p.cenaPoOsobi} RSD · ${p.kapacitet} mesta`}
              selected={selPrevoz.has(p.id)}
              onPress={() => onSelectPrevoz(p.id)}
            />
          ))}
        </View>
      ) : null}

      {rent.length > 0 ? (
        <View style={styles.section}>
          <Text variant="small" color={colors.textMuted}>
            Iznajmljiva oprema
          </Text>
          {rent.map((r) => (
            <View key={r.id} style={styles.rentRow}>
              <Text>{r.nazivOpreme}</Text>
              <View style={styles.rentQty}>
                <Pressable onPress={() => onChangeRent(r.id, -1, r.dostupnaKolicina)}>
                  <Text variant="label">−</Text>
                </Pressable>
                <Text>{selRent[r.id] ?? 0}</Text>
                <Pressable onPress={() => onChangeRent(r.id, 1, r.dostupnaKolicina)}>
                  <Text variant="label">+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {oprema.length > 0 ? (
        <View style={styles.section}>
          <Text variant="small" color={colors.textMuted}>
            Obavezna oprema
          </Text>
          {oprema.map((o) => (
            <Text key={o.id} variant="small" color={colors.textMuted}>
              · {o.naziv}
              {o.obavezna ? ' (obavezna)' : ''}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  section: { gap: spacing.xs, marginTop: spacing.sm },
  option: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.brand, backgroundColor: '#ecfdf5' },
  rentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rentQty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
})
