import { forwardRef, type ReactNode } from 'react'
import Map, { NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl'
import { resolvePlaninerMapStyle } from '../style/resolvePlaninerMapStyle'
import { MapStyleMissing } from './MapStyleMissing'

export type PlaninerMapFrameProps = {
  className?: string
  initialViewState: {
    longitude: number
    latitude: number
    zoom: number
  }
  children?: ReactNode
  onClick?: (e: MapLayerMouseEvent) => void
  scrollZoom?: boolean
  showZoomControls?: boolean
}

export const PlaninerMapFrame = forwardRef<MapRef, PlaninerMapFrameProps>(function PlaninerMapFrame(props, ref) {
  const resolved = resolvePlaninerMapStyle()
  if (!resolved) {
    return (
      <div className={`relative ${props.className ?? ''}`.trim()}>
        <MapStyleMissing className="h-full min-h-[14rem] w-full" />
      </div>
    )
  }

  const {
    className = '',
    initialViewState,
    children,
    onClick,
    scrollZoom = true,
    showZoomControls = true,
  } = props

  return (
    <div className={`planiner-map-frame relative overflow-hidden ${className}`.trim()}>
      <Map
        ref={ref}
        mapLib={maplibregl}
        mapStyle={resolved.styleUrl}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        onClick={onClick}
        scrollZoom={scrollZoom}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        reuseMaps
        attributionControl={{ compact: true }}
      >
        {showZoomControls && <NavigationControl position="top-right" showCompass={false} />}
        {children}
      </Map>
    </div>
  )
})
