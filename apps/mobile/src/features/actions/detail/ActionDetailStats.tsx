import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaDetail } from '@beleg/shared'
import { computePERForAkcija } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailStatsProps {
  akcija: AkcijaDetail
  memberCount: number
}

type StatCell = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}

function buildMountainCells(akcija: AkcijaDetail, memberCountLabel: string): StatCell[] {
  const per = computePERForAkcija(akcija)
  const cells: StatCell[] = [
    { icon: 'triangle-outline', label: 'Planina', value: akcija.planina || '—' },
    { icon: 'flag-outline', label: 'Vrh', value: akcija.vrh || '—' },
  ]
  if (akcija.duzinaStazeKm != null && akcija.duzinaStazeKm > 0) {
    cells.push({
      icon: 'resize-outline',
      label: 'Dužina staze',
      value: `${akcija.duzinaStazeKm.toFixed(1)} km`,
    })
  }
  if (akcija.kumulativniUsponM != null && akcija.kumulativniUsponM > 0) {
    cells.push({
      icon: 'trending-up-outline',
      label: 'Uspon',
      value: `${akcija.kumulativniUsponM} m`,
    })
  }
  if (per > 0) {
    cells.push({ icon: 'star-outline', label: 'PER', value: String(per) })
  }
  if (akcija.visinaVrhM != null && akcija.visinaVrhM > 0) {
    cells.push({
      icon: 'arrow-up-outline',
      label: 'Visina',
      value: `${akcija.visinaVrhM} m`,
    })
  }
  cells.push({ icon: 'people-outline', label: 'Prijavljeno', value: memberCountLabel })
  return cells
}

export function ActionDetailStats({ akcija, memberCount }: ActionDetailStatsProps) {
  const isFerrata = akcija.tipAkcije === 'via_ferrata'
  const snap = akcija.ferrataSnapshot
  const memberCountLabel =
    akcija.maxLjudi && akcija.maxLjudi > 0
      ? `${memberCount} / ${akcija.maxLjudi}`
      : String(memberCount)

  const cells: StatCell[] = isFerrata
    ? [
        { icon: 'trail-sign-outline', label: 'Ferata', value: snap?.naziv || akcija.naziv },
        { icon: 'map-outline', label: 'Region', value: snap?.lokacija || akcija.planina || '—' },
        { icon: 'people-outline', label: 'Prijavljeno', value: memberCountLabel },
        { icon: 'fitness-outline', label: 'Težina', value: akcija.tezina || snap?.tezina || '—' },
      ]
    : buildMountainCells(akcija, memberCountLabel)

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
