import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaDetail } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailStatsProps {
  akcija: AkcijaDetail
  memberCount: number
}

export function ActionDetailStats({ akcija, memberCount }: ActionDetailStatsProps) {
  const isFerrata = akcija.tipAkcije === 'via_ferrata'
  const snap = akcija.ferrataSnapshot
  const memberCountLabel =
    akcija.maxLjudi && akcija.maxLjudi > 0
      ? `${memberCount} / ${akcija.maxLjudi}`
      : String(memberCount)

  const cells = isFerrata
    ? [
        { icon: 'trail-sign-outline' as const, label: 'Ferata', value: snap?.naziv || akcija.naziv },
        { icon: 'map-outline' as const, label: 'Region', value: snap?.lokacija || akcija.planina || '—' },
        { icon: 'people-outline' as const, label: 'Prijavljeno', value: memberCountLabel },
        { icon: 'fitness-outline' as const, label: 'Težina', value: akcija.tezina || snap?.tezina || '—' },
      ]
    : [
        { icon: 'triangle-outline' as const, label: 'Planina', value: akcija.planina || '—' },
        { icon: 'flag-outline' as const, label: 'Vrh', value: akcija.vrh || '—' },
        {
          icon: 'trending-up-outline' as const,
          label: 'Visina',
          value: akcija.visinaVrhM != null ? `${akcija.visinaVrhM} m` : '—',
        },
        { icon: 'people-outline' as const, label: 'Prijavljeno', value: memberCountLabel },
      ]

  return (
    <View style={styles.grid}>
      {cells.map((c) => (
        <View key={c.label} style={styles.cell}>
          <Ionicons name={c.icon} size={16} color={colors.brand} />
          <Text variant="small" color={colors.textMuted}>
            {c.label}
          </Text>
          <Text variant="label" numberOfLines={2}>
            {c.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  cell: {
    width: '47%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
})
