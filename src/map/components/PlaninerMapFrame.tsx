import { forwardRef, type ReactNode } from 'react'
import Map, { NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl'
import { resolvePlaninerMapStyle } from '../style/resolvePlaninerMapStyle'
import { MapStyleMissing } from './MapStyleMissing'

export type PlaninerMapFrameProps = {
  className?: string
  /** Pun URL MapLibre stila; ako je prazan, koristi se resolvePlaninerMapStyle(). */
  mapStyleUrl?: string | null
  /** Blagi boost kontrasta na canvas-u da putevi / linije budu čitljiviji (detalj ferate, editor…). */
  boostPathVisibility?: boolean
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
  const override = props.mapStyleUrl?.trim()
  if (!resolved && !override) {
    return (
      <div className={`relative ${props.className ?? ''}`.trim()}>
        <MapStyleMissing className="h-full min-h-[14rem] w-full" />
      </div>
    )
  }

  const {
    className = '',
    boostPathVisibility,
    initialViewState,
    children,
    onClick,
    scrollZoom = true,
    showZoomControls = true,
  } = props

  const styleUrl = override || resolved!.styleUrl

  return (
    <div
      className={`planiner-map-frame relative overflow-hidden ${boostPathVisibility ? 'planiner-map-frame--boost-paths ' : ''}${className}`.trim()}
    >
      <Map
        ref={ref}
        mapLib={maplibregl}
        mapStyle={styleUrl}
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
