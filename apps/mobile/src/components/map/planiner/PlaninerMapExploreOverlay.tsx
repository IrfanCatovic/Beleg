import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from '../../ui'
import { colors, radius, spacing } from '../../../theme'

interface LayerChipProps {
  label: string
  count: number
  active: boolean
  dotColor: string
  activeBorder: string
  activeBg: string
  activeText: string
  countBg: string
  onPress: () => void
}

function LayerChip({
  label,
  count,
  active,
  dotColor,
  activeBorder,
  activeBg,
  activeText,
  countBg,
  onPress,
}: LayerChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { borderColor: activeBorder, backgroundColor: activeBg }
          : { borderColor: colors.border, backgroundColor: colors.white },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text variant="small" style={{ color: active ? activeText : colors.textMuted, fontWeight: '700' }}>
        {label}
      </Text>
      <View style={[styles.countBadge, { backgroundColor: countBg }]}>
        <Text variant="small" style={{ fontSize: 10, fontWeight: '800', color: activeText }}>
          {count}
        </Text>
      </View>
    </Pressable>
  )
}

interface PlaninerMapExploreOverlayProps {
  ferrataCount: number
  hotelCount: number
  peakCount: number
  showFerrate: boolean
  showHotels: boolean
  showPeaks: boolean
  onToggleFerrate: () => void
  onToggleHotels: () => void
  onTogglePeaks: () => void
}

export function PlaninerMapExploreOverlay({
  ferrataCount,
  hotelCount,
  peakCount,
  showFerrate,
  showHotels,
  showPeaks,
  onToggleFerrate,
  onToggleHotels,
  onTogglePeaks,
}: PlaninerMapExploreOverlayProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text variant="heading" style={styles.title}>
            ⛰️ Mapa avantura
          </Text>
          <Text variant="small" color={colors.textMuted}>
            Pronađi svoju sledeću avanturu
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <LayerChip
            label="Ferate"
            count={ferrataCount}
            active={showFerrate}
            dotColor="#34d399"
            activeBorder="#6ee7b7"
            activeBg="#ecfdf5"
            activeText="#065f46"
            countBg="#d1fae5"
            onPress={onToggleFerrate}
          />
          <LayerChip
            label="Hoteli"
            count={hotelCount}
            active={showHotels}
            dotColor="#fbbf24"
            activeBorder="#fcd34d"
            activeBg="#fffbeb"
            activeText="#92400e"
            countBg="#fef3c7"
            onPress={onToggleHotels}
          />
          <LayerChip
            label="Vrhovi"
            count={peakCount}
            active={showPeaks}
            dotColor="#818cf8"
            activeBorder="#a5b4fc"
            activeBg="#eef2ff"
            activeText="#3730a3"
            countBg="#e0e7ff"
            onPress={onTogglePeaks}
          />
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#d1fae5',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  header: { gap: 2 },
  title: { color: '#064e3b' },
  chipsRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  countBadge: { borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1 },
})
