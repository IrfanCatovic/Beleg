import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native'
import type { GPSPoint } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { getMobilePlaninerMapStyle } from '../../../utils/planinerMapStyle'
import { colors } from '../../../theme'

interface Props {
  points: GPSPoint[]
  follow?: boolean
}

const DEFAULT_CENTER: [number, number] = [21.0059, 44.0165]

export function ActivityLiveMap({ points, follow = true }: Props) {
  const cameraRef = useRef<CameraRef>(null)
  const mapStyle = getMobilePlaninerMapStyle()

  const coords = useMemo<[number, number][]>(
    () => points.map((p) => [p.lng, p.lat]),
    [points],
  )

  const last = coords.length > 0 ? coords[coords.length - 1] : DEFAULT_CENTER

  const lineShape = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    }),
    [coords],
  )

  useEffect(() => {
    if (follow && coords.length > 0) {
      cameraRef.current?.easeTo({ center: last, zoom: 15, duration: 500 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, follow])

  if (!mapStyle) {
    return (
      <View style={styles.root}>
        <Text variant="small" color={colors.textMuted}>
          Mapa nije dostupna.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <Map style={StyleSheet.absoluteFill} mapStyle={mapStyle.styleUrl} logo={false}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: last, zoom: coords.length > 0 ? 15 : 6.2 }}
        />
        {coords.length > 1 ? (
          <GeoJSONSource id="adventure-live-route" data={lineShape}>
            <Layer
              id="adventure-live-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': colors.brand, 'line-width': 4 }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
})
