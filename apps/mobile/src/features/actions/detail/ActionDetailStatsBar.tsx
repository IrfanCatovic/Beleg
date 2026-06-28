import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaDetail } from '@beleg/shared'
import { computePERForAkcija } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailStatsBarProps {
  akcija: AkcijaDetail
  memberCount: number
}

type StatCell = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}

function buildMountainCells(akcija: AkcijaDetail, memberLabel: string): StatCell[] {
  const per = computePERForAkcija(akcija)
  const cells: StatCell[] = [
    { icon: 'triangle-outline', label: 'PLANINA', value: akcija.planina || '—' },
    { icon: 'flag-outline', label: 'VRH', value: akcija.vrh || '—' },
  ]
  if (akcija.duzinaStazeKm != null && akcija.duzinaStazeKm > 0) {
    cells.push({
      icon: 'resize-outline',
      label: 'DUŽINA STAZE',
      value: `${akcija.duzinaStazeKm.toFixed(1)} km`,
    })
  }
  if (akcija.kumulativniUsponM != null && akcija.kumulativniUsponM > 0) {
    cells.push({
      icon: 'trending-up-outline',
      label: 'USPON',
      value: `${akcija.kumulativniUsponM} m`,
    })
  }
  if (per > 0) {
    cells.push({ icon: 'star-outline', label: 'PER', value: String(per) })
  }
  if (akcija.visinaVrhM != null && akcija.visinaVrhM > 0) {
    cells.push({
      icon: 'arrow-up-outline',
      label: 'VISINA',
      value: `${akcija.visinaVrhM} m`,
    })
  }
  cells.push({ icon: 'people-outline', label: 'PRIJAVLJENIH', value: memberLabel })
  return cells
}

export function ActionDetailStatsBar({ akcija, memberCount }: ActionDetailStatsBarProps) {
  const isFerrata = akcija.tipAkcije === 'via_ferrata'
  const snap = akcija.ferrataSnapshot
  const memberLabel =
    akcija.maxLjudi && akcija.maxLjudi > 0
      ? `${memberCount} / ${akcija.maxLjudi}`
      : String(memberCount)

  const cells: StatCell[] = isFerrata
    ? [
        { icon: 'trail-sign-outline', label: 'FERATA', value: snap?.naziv || akcija.naziv },
        { icon: 'map-outline', label: 'REGION', value: snap?.lokacija || akcija.planina || '—' },
        { icon: 'people-outline', label: 'PRIJAVLJENO', value: memberLabel },
        { icon: 'fitness-outline', label: 'TEŽINA', value: akcija.tezina || snap?.tezina || '—' },
      ]
    : buildMountainCells(akcija, memberLabel)

  const cols = 2
  const rows = Math.ceil(cells.length / cols)

  return (
    <View style={styles.bar}>
      <View style={styles.grid}>
        {cells.map((c, i) => (
          <View
            key={c.label}
            style={[
              styles.cell,
              i % cols !== cols - 1 && styles.cellBorderRight,
              Math.floor(i / cols) < rows - 1 && styles.cellBorderBottom,
            ]}
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
