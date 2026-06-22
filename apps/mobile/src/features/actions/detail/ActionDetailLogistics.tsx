import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaDetail } from '@beleg/shared'
import { Card, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

function OptionCard({
  label,
  sub,
  price,
  selected,
  onPress,
}: {
  label: string
  sub?: string
  price?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.optionCard, selected && styles.optionCardSelected]}>
      <View style={styles.optionLeft}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
        <View style={styles.optionText}>
          <Text variant="label">{label}</Text>
          {sub ? (
            <Text variant="small" color={colors.textMuted}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {price ? (
        <Text variant="label" color={colors.brand}>
          {price}
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
      <View style={styles.header}>
        <Ionicons name="layers-outline" size={20} color={colors.brand} />
        <Text variant="heading">Logistika</Text>
      </View>
      <Text variant="small" color={colors.textMuted}>
        Izaberite smeštaj, prevoz i opremu za vašu prijavu.
      </Text>

      {smestaj.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Ionicons name="bed-outline" size={18} color={colors.textMuted} />
            <Text variant="label">Smeštaj</Text>
          </View>
          {smestaj.map((s) => (
            <OptionCard
              key={s.id}
              label={s.naziv}
              price={`${s.cenaPoOsobiUkupno} RSD`}
              selected={selSmestaj.has(s.id)}
              onPress={() => onToggleSmestaj(s.id)}
            />
          ))}
        </View>
      ) : null}

      {prevoz.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Ionicons name="car-outline" size={18} color={colors.textMuted} />
            <Text variant="label">Prevoz</Text>
          </View>
          {prevoz.map((p) => (
            <OptionCard
              key={p.id}
              label={`${p.nazivGrupe} (${p.tipPrevoza})`}
              sub={`${p.kapacitet} mesta`}
              price={`${p.cenaPoOsobi} RSD`}
              selected={selPrevoz.has(p.id)}
              onPress={() => onSelectPrevoz(p.id)}
            />
          ))}
        </View>
      ) : null}

      {rent.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Ionicons name="construct-outline" size={18} color={colors.textMuted} />
            <Text variant="label">Iznajmljiva oprema</Text>
          </View>
          {rent.map((r) => (
            <View key={r.id} style={styles.rentRow}>
              <View style={styles.rentInfo}>
                <Text variant="label">{r.nazivOpreme}</Text>
                <Text variant="small" color={colors.textMuted}>
                  {r.cenaPoSetu} RSD / set
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => onChangeRent(r.id, -1, r.dostupnaKolicina)}
                  style={styles.stepBtn}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Text variant="label" style={styles.stepValue}>
                  {selRent[r.id] ?? 0}
                </Text>
                <Pressable
                  onPress={() => onChangeRent(r.id, 1, r.dostupnaKolicina)}
                  style={styles.stepBtn}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {oprema.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.textMuted} />
            <Text variant="label">Obavezna oprema</Text>
          </View>
          <View style={styles.chipRow}>
            {oprema.map((o) => (
              <View key={o.id} style={styles.chip}>
                <Text variant="small">
                  {o.naziv}
                  {o.obavezna ? ' *' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md, backgroundColor: colors.surfaceAlt },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: colors.brand,
    backgroundColor: '#ecfdf5',
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  optionText: { flex: 1, gap: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  rentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rentInfo: { flex: 1, gap: 2 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 24, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
})
