import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colors } from '../../../theme'
import { projectRouteToSvg, type RouteLatLng } from '../services/projectAdventureRoute'

export const ADVENTURE_ROUTE_SVG_WIDTH = 220
export const ADVENTURE_ROUTE_SVG_HEIGHT = 118
/** ~10% of the shorter route-box edge — matches prior ROUTE_PAD = 12. */
export const ADVENTURE_ROUTE_SVG_PADDING = 12
export const ADVENTURE_ROUTE_STROKE_WIDTH = 3.5

interface Props {
  points: ReadonlyArray<RouteLatLng>
  width?: number
  height?: number
  padding?: number
  strokeColor?: string
  strokeWidth?: number
}

/**
 * Continuous Adventure route as a single SVG Path (no View-per-point dots).
 * Transparent — no background Rect / fill.
 */
export function AdventureRouteSvg({
  points,
  width = ADVENTURE_ROUTE_SVG_WIDTH,
  height = ADVENTURE_ROUTE_SVG_HEIGHT,
  padding = ADVENTURE_ROUTE_SVG_PADDING,
  strokeColor = colors.brand,
  strokeWidth = ADVENTURE_ROUTE_STROKE_WIDTH,
}: Props) {
  const { pathD } = useMemo(
    () => projectRouteToSvg(points, width, height, padding),
    [points, width, height, padding],
  )

  if (!pathD) return null

  return (
    <View style={[styles.wrap, { width, height }]} collapsable={false}>
      <Svg width={width} height={height} style={styles.svg}>
        <Path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  svg: {
    backgroundColor: 'transparent',
  },
})
