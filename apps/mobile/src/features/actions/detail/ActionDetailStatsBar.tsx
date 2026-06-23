import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaDetail } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailStatsBarProps {
  akcija: AkcijaDetail
  memberCount: number
}

export function ActionDetailStatsBar({ akcija, memberCount }: ActionDetailStatsBarProps) {
  const isFerrata = akcija.tipAkcije === 'via_ferrata'
  const snap = akcija.ferrataSnapshot
  const memberLabel =
    akcija.maxLjudi && akcija.maxLjudi > 0
      ? `${memberCount} / ${akcija.maxLjudi}`
      : String(memberCount)

  const cells = isFerrata
    ? [
        { icon: 'trail-sign-outline' as const, label: 'FERATA', value: snap?.naziv || akcija.naziv },
        { icon: 'map-outline' as const, label: 'REGION', value: snap?.lokacija || akcija.planina || '—' },
        { icon: 'people-outline' as const, label: 'PRIJAVLJENO', value: memberLabel },
        { icon: 'fitness-outline' as const, label: 'TEŽINA', value: akcija.tezina || snap?.tezina || '—' },
      ]
    : [
        { icon: 'triangle-outline' as const, label: 'PLANINA', value: akcija.planina || '—' },
        { icon: 'flag-outline' as const, label: 'VRH', value: akcija.vrh || '—' },
        {
          icon: 'trending-up-outline' as const,
          label: 'VISINA',
          value: akcija.visinaVrhM != null ? `${akcija.visinaVrhM} m` : '—',
        },
        { icon: 'people-outline' as const, label: 'PRIJAVLJENIH', value: memberLabel },
      ]

  return (
    <View style={styles.bar}>
      <View style={styles.grid}>
        {cells.map((c, i) => (
          <View
            key={c.label}
            style={[styles.cell, i % 2 === 0 && styles.cellBorderRight, i < 2 && styles.cellBorderBottom]}
          >
            <Ionicons name={c.icon} size={14} color={colors.brand} />
            <Text style={styles.value} numberOfLines={2}>
              {c.value}
            </Text>
            <Text style={styles.label}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '50%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  cellBorderRight: { borderRightWidth: 1, borderRightColor: colors.border },
  cellBorderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border },
  value: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  label: { fontSize: 9, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5 },
})
