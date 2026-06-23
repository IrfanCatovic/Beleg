import { StyleSheet, View } from 'react-native'
import type { GPSPoint } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { colors } from '../../../theme'

interface Props {
  points: GPSPoint[]
  follow?: boolean
}

export function ActivityLiveMap({ points }: Props) {
  return (
    <View style={styles.root}>
      <Text variant="small" color={colors.textMuted}>
        Live mapa nije dostupna u browseru
        {points.length > 0 ? ` (${points.length} tačaka)` : ''}.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
})
