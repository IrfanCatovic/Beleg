import { StyleSheet, View } from 'react-native'
import type { GPSPoint } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { colors, radius } from '../../../theme'

interface Props {
  points: GPSPoint[]
  follow?: boolean
  height?: number
}

export function ActivityLiveMap({ points, height = 220 }: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Text variant="small" color={colors.textMuted}>
        Live mapa nije dostupna u browseru
        {points.length > 0 ? ` (${points.length} tačaka)` : ''}.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
})
