import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native'
import type { GPSPoint } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { getMobilePlaninerMapStyle } from '../../../utils/planinerMapStyle'
import { colors, radius } from '../../../theme'
import { buildLiveRouteLineString, shouldUpdateFollowCamera, type LngLat } from '../services/liveRouteGeometry'

interface Props {
  points: GPSPoint[]
  follow?: boolean
  height?: number
}

const DEFAULT_CENTER: LngLat = [21.0059, 44.0165]

export function ActivityLiveMap({ points, follow = true, height = 220 }: Props) {
  const cameraRef = useRef<CameraRef>(null)
  const lastFollowAtMs = useRef<number | null>(null)
  const lastFollowLngLat = useRef<LngLat | null>(null)
  const mapStyle = getMobilePlaninerMapStyle()

  const lastPoint = points[points.length - 1]
  const last: LngLat = lastPoint ? [lastPoint.lng, lastPoint.lat] : DEFAULT_CENTER
  const lineShape = useMemo(() => buildLiveRouteLineString(points), [points])

  useEffect(() => {
    if (!follow || !lastPoint) return
    const nowMs = Date.now()
    if (
      !shouldUpdateFollowCamera({
        lastFollowAtMs: lastFollowAtMs.current,
        lastFollowLngLat: lastFollowLngLat.current,
        nextLngLat: last,
        nowMs,
      })
    ) {
      return
    }
    lastFollowAtMs.current = nowMs
    lastFollowLngLat.current = last
    cameraRef.current?.easeTo({ center: last, zoom: 15, duration: 180 })
  }, [follow, lastPoint])

  if (!mapStyle) {
    return (
      <View style={[styles.wrap, { height }]}>
        <Text variant="small" color={colors.textMuted}>
          Mapa nije dostupna.
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <Map style={StyleSheet.absoluteFill} mapStyle={mapStyle.styleUrl} logo={false}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: last, zoom: points.length > 0 ? 15 : 6.2 }}
        />
        {lineShape ? (
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
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
