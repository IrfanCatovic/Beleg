import { StyleSheet, View } from 'react-native'
import type { LatLngAlt } from '../services/activityMetrics'
import { Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

interface Props {
  points: LatLngAlt[]
  height?: number
}

export function ActivityRouteMap({ points, height = 220 }: Props) {
  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text variant="small" color={colors.textMuted}>
          Ruta nije snimljena.
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <Text variant="small" color={colors.textMuted}>
        Pregled rute na mapi nije dostupan u browseru ({points.length} tačaka).
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  empty: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
})
