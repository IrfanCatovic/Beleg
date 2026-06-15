import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import maplibregl from 'maplibre-gl'
import { Marker, type MapRef } from 'react-map-gl/maplibre'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { FerrataMarkerElement } from '../../map/markers/FerrataMarkerElement'
import { FerrataCatalogMapPopup } from '../../map/components/MapExplorePopups'

export type CatalogMapMarker = {
  id: number
  slug: string
  naziv: string
  subtitle: string
  tezina: string
  lat: number
  lng: number
}

const DEFAULT_CENTER = { longitude: 21.0059, latitude: 44.0165, zoom: 6.2 }

export function FerrataCatalogMap(props: {
  markers: CatalogMapMarker[]
  emptyHint: string
  className?: string
}) {
  const { t } = useTranslation('ferrate')
  const mapRef = useRef<MapRef>(null)
  const [popupId, setPopupId] = useState<number | null>(null)

  const markerKey = useMemo(
    () => props.markers.map((m) => `${m.id}:${m.lat.toFixed(4)}:${m.lng.toFixed(4)}`).join('|'),
    [props.markers],
  )

  const fitMarkers = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const { markers } = props
    if (markers.length === 0) {
      map.jumpTo({ center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude], zoom: DEFAULT_CENTER.zoom })
      return
    }
    if (markers.length === 1) {
      map.jumpTo({ center: [markers[0].lng, markers[0].lat], zoom: 11 })
      return
    }
    const b = new maplibregl.LngLatBounds()
    for (const m of markers) b.extend([m.lng, m.lat])
    map.fitBounds(b, { padding: 52, maxZoom: 12, duration: 0 })
  }, [props.markers])

  useEffect(() => {
    setPopupId(null)
  }, [markerKey])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const run = () => fitMarkers()
    if (map.isStyleLoaded()) run()
    else map.once('load', run)
    return () => {
      map.off('load', run)
    }
  }, [fitMarkers, markerKey])

  const activePopup = popupId != null ? props.markers.find((m) => m.id === popupId) : undefined

  return (
    <div className={props.className ?? ''}>
      <div className="relative z-0 h-56 w-full overflow-hidden rounded-xl bg-slate-100/80 ring-1 ring-emerald-900/10 shadow-inner sm:h-64">
        <PlaninerMapFrame
          key={markerKey || 'empty'}
          ref={mapRef}
          className="h-full w-full"
          initialViewState={DEFAULT_CENTER}
          showZoomControls
        >
          {props.markers.map((m) => (
            <Marker
              key={m.id}
              longitude={m.lng}
              latitude={m.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setPopupId((id) => (id === m.id ? null : m.id))
              }}
            >
              <div className="touch-manipulation" role="presentation">
                <FerrataMarkerElement active={popupId === m.id} />
              </div>
            </Marker>
          ))}
          {activePopup && (
            <FerrataCatalogMapPopup marker={activePopup} onClose={() => setPopupId(null)} t={t} />
          )}
        </PlaninerMapFrame>
      </div>
      {props.markers.length === 0 && (
        <p className="mt-2 px-2 text-center text-xs text-gray-500">{props.emptyHint}</p>
      )}
    </div>
  )
}
