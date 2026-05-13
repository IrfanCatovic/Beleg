import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { Marker, Popup, type MapRef } from 'react-map-gl/maplibre'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { FerrataMarkerElement } from '../../map/markers/FerrataMarkerElement'

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

function difficultyBadgeClass(tezina: string) {
  const s = tezina.toUpperCase()
  if (s.includes('E')) return 'bg-zinc-900 text-white border-zinc-800'
  if (s.includes('D')) return 'bg-rose-600 text-white border-rose-700'
  if (s.includes('C')) return 'bg-amber-500 text-white border-amber-600'
  if (s.includes('B')) return 'bg-sky-600 text-white border-sky-700'
  if (s.includes('A')) return 'bg-emerald-600 text-white border-emerald-700'
  return 'bg-slate-600 text-white border-slate-700'
}

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
                <FerrataMarkerElement />
              </div>
            </Marker>
          ))}
          {activePopup && (
            <Popup
              longitude={activePopup.lng}
              latitude={activePopup.lat}
              anchor="bottom"
              offset={18}
              onClose={() => setPopupId(null)}
              closeButton
              closeOnClick={false}
              maxWidth="280px"
            >
              <div className="min-w-[11rem] space-y-2 p-1 text-sm">
                <p className="font-bold leading-snug text-gray-900">{activePopup.naziv}</p>
                {activePopup.subtitle?.trim() && <p className="text-xs text-gray-600">{activePopup.subtitle}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-lg border px-2 py-0.5 text-[11px] font-bold ${difficultyBadgeClass(activePopup.tezina)}`}
                  >
                    {activePopup.tezina}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {t('listMapPopupDifficulty')}
                  </span>
                </div>
                <Link
                  to={`/ferate/${activePopup.slug}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  {t('listMapPopupView')}
                </Link>
              </div>
            </Popup>
          )}
        </PlaninerMapFrame>
      </div>
      {props.markers.length === 0 && (
        <p className="mt-2 px-2 text-center text-xs text-gray-500">{props.emptyHint}</p>
      )}
    </div>
  )
}
