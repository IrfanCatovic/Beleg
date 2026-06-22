import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import type { GPSPoint } from '@beleg/shared'
import { colors } from '../../../theme'

interface Props {
  points: GPSPoint[]
  follow?: boolean
}

export function ActivityLiveMap({ points, follow = true }: Props) {
  const region = useMemo(() => {
    if (points.length === 0) {
      return {
        latitude: 44.0165,
        longitude: 21.0059,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    }
    const last = points[points.length - 1]
    return {
      latitude: last.lat,
      longitude: last.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }
  }, [points])

  const coords = useMemo(
    () => points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [points],
  )

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region}
        showsUserLocation
        followsUserLocation={follow && points.length > 0}
      >
        {coords.length > 1 ? (
          <Polyline coordinates={coords} strokeColor={colors.brand} strokeWidth={4} />
        ) : null}
      </MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
})
