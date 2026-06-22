import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import type { LatLngAlt } from '../services/activityMetrics'
import { Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

interface Props {
  points: LatLngAlt[]
  height?: number
}

export function ActivityRouteMap({ points, height = 220 }: Props) {
  const mapRef = useRef<MapView>(null)

  const coords = useMemo(
    () => points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [points],
  )

  const region = useMemo(() => {
    if (coords.length === 0) return null
    if (coords.length === 1) {
      return {
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    }
    const lats = coords.map((c) => c.latitude)
    const lngs = coords.map((c) => c.longitude)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const pad = 0.002
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, maxLat - minLat + pad),
      longitudeDelta: Math.max(0.01, maxLng - minLng + pad),
    }
  }, [coords])

  useEffect(() => {
    if (!mapRef.current || coords.length < 2) return
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    })
  }, [coords])

  if (coords.length === 0) {
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
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={region ?? undefined}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {coords.length > 1 ? (
          <Polyline coordinates={coords} strokeColor={colors.brand} strokeWidth={4} />
        ) : null}
      </MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  empty: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
})
