import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native'
import type { LatLngAlt } from '../services/activityMetrics'
import { Text } from '../../../components/ui'
import { getMobilePlaninerMapStyle } from '../../../utils/planinerMapStyle'
import { colors, radius, spacing } from '../../../theme'

interface Props {
  points: LatLngAlt[]
  height?: number
}

const DEFAULT_CENTER: [number, number] = [21.0059, 44.0165]

export function ActivityRouteMap({ points, height = 220 }: Props) {
  const cameraRef = useRef<CameraRef>(null)
  const mapStyle = getMobilePlaninerMapStyle()

  const coords = useMemo<[number, number][]>(
    () => points.map((p) => [p.lng, p.lat]),
    [points],
  )

  const lineShape = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    }),
    [coords],
  )

  const fit = () => {
    // #region agent log
    console.log('[adv-debug] ActivityRouteMap render', {
      points: coords.length,
      hasStyle: !!mapStyle,
    })
    // #endregion
    if (coords.length === 1) {
      cameraRef.current?.jumpTo({ center: coords[0], zoom: 14 })
      return
    }
    if (coords.length >= 2) {
      const lngs = coords.map((c) => c[0])
      const lats = coords.map((c) => c[1])
      cameraRef.current?.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 300 },
      )
    }
  }

  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!mapStyle) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text variant="small" color={colors.textMuted}>
          Mapa nije dostupna ({coords.length} tačaka).
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle.styleUrl}
        logo={false}
        attribution
        attributionPosition={{ bottom: 6, left: 6 }}
        dragPan={false}
        touchZoom={false}
        touchRotate={false}
        touchPitch={false}
        onDidFinishLoadingMap={fit}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: coords[0] ?? DEFAULT_CENTER, zoom: 12 }}
        />
        <GeoJSONSource id="adventure-route" data={lineShape}>
          <Layer
            id="adventure-route-line"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': colors.brand, 'line-width': 4 }}
          />
        </GeoJSONSource>
      </Map>
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
