import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, spacing } from '../../theme'
import { Text } from '../ui'

interface MapMarkersProps {
  active?: boolean
  variant: 'ferrata' | 'hotel' | 'peak'
}

const VARIANTS = {
  ferrata: { bg: '#059669', icon: 'link' as const },
  hotel: { bg: '#f59e0b', icon: 'bed' as const },
  peak: { bg: '#4f46e5', icon: 'triangle' as const },
}

export function MapMarkerPin({ active, variant }: MapMarkersProps) {
  const v = VARIANTS[variant]
  return (
    <View style={[styles.wrap, active && styles.wrapActive]}>
      <View style={[styles.circle, { backgroundColor: v.bg }]}>
        <Ionicons name={v.icon} size={18} color={colors.white} />
      </View>
    </View>
  )
}

interface MapOverlayProps {
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

export function AdventureMapOverlay({
  ferrataCount,
  hotelCount,
  peakCount,
  showFerrate,
  showHotels,
  showPeaks,
  onToggleFerrate,
  onToggleHotels,
  onTogglePeaks,
}: MapOverlayProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.glass}>
        <Text variant="label" color={colors.textOnDark}>
          Mapa avantura
        </Text>
        <Text variant="small" color={colors.textOnDarkMuted}>
          Pronađi svoju sledeću avanturu
        </Text>
        <View style={styles.chips}>
          <LayerChip label={`Ferate (${ferrataCount})`} active={showFerrate} onPress={onToggleFerrate} />
          <LayerChip label={`Hoteli (${hotelCount})`} active={showHotels} onPress={onToggleHotels} />
          <LayerChip label={`Vrhovi (${peakCount})`} active={showPeaks} onPress={onTogglePeaks} />
        </View>
      </View>
    </View>
  )
}

function LayerChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.layerChip, active && styles.layerChipActive]}>
      <Text variant="small" color={active ? colors.textOnDark : colors.textOnDarkMuted}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  wrapActive: { transform: [{ scale: 1.08 }] },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  glass: {
    backgroundColor: 'rgba(30, 41, 59, 0.88)',
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.navBorder,
    gap: spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  layerChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  layerChipActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
})
