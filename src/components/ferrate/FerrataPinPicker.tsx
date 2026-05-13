import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Marker, type MapRef } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { FerrataMarkerElement } from '../../map/markers/FerrataMarkerElement'

const DEFAULT_CENTER = { longitude: 21.0059, latitude: 44.0165, zoom: 6.2 }
const PICK_ZOOM = 13.5

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type Props = {
  lat: string
  lng: string
  onLatChange: (v: string) => void
  onLngChange: (v: string) => void
  /** Početni centar ako još nema tačke (npr. glavna ferata). */
  hintCenter?: { lat: number; lng: number } | null
  /** Niža mapa u formi */
  compact?: boolean
}

/**
 * Jedna tačka na mapi — klik postavlja marker, marker se vuče; sinhrono sa lat/lng poljima.
 */
export function FerrataPinPicker(props: Props) {
  const { t } = useTranslation('ferrate')
  const mapRef = useRef<MapRef>(null)

  const latNum = parseCoord(props.lat)
  const lngNum = parseCoord(props.lng)
  const hasPin = latNum != null && lngNum != null

  const setPin = useCallback(
    (lat: number, lng: number) => {
      props.onLatChange(lat.toFixed(6))
      props.onLngChange(lng.toFixed(6))
    },
    [props.onLatChange, props.onLngChange],
  )

  const clearPin = useCallback(() => {
    props.onLatChange('')
    props.onLngChange('')
  }, [props.onLatChange, props.onLngChange])

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      setPin(e.lngLat.lat, e.lngLat.lng)
    },
    [setPin],
  )

  const initialViewState = useMemo(() => {
    if (hasPin) return { longitude: lngNum!, latitude: latNum!, zoom: PICK_ZOOM }
    const h = props.hintCenter
    if (h && Number.isFinite(h.lat) && Number.isFinite(h.lng)) {
      return { longitude: h.lng, latitude: h.lat, zoom: 11 }
    }
    return DEFAULT_CENTER
  }, [hasPin, latNum, lngNum, props.hintCenter])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const run = () => {
      if (hasPin) {
        map.easeTo({
          center: [lngNum!, latNum!],
          zoom: Math.max(map.getZoom(), PICK_ZOOM - 0.5),
          duration: 400,
        })
      }
    }
    if (map.isStyleLoaded()) run()
    else map.once('load', run)
    return () => {
      map.off('load', run)
    }
  }, [hasPin, latNum, lngNum])

  const hClass = props.compact ? 'h-44 sm:h-52' : 'h-56 sm:h-64'

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-gray-500">{t('smestajMapHint')}</p>
      <div className={`overflow-hidden rounded-xl border border-gray-200 bg-slate-100/80 shadow-inner ring-1 ring-emerald-900/10 ${hClass}`}>
        <PlaninerMapFrame
          ref={mapRef}
          className="h-full w-full"
          initialViewState={initialViewState}
          onClick={onMapClick}
          boostPathVisibility
          showZoomControls
        >
          {hasPin && (
            <Marker
              longitude={lngNum!}
              latitude={latNum!}
              anchor="bottom"
              draggable
              onDragEnd={(e) => {
                const { lng, lat } = e.lngLat
                setPin(lat, lng)
              }}
            >
              <FerrataMarkerElement />
            </Marker>
          )}
        </PlaninerMapFrame>
      </div>
      {hasPin && (
        <button type="button" onClick={clearPin} className="text-[11px] font-semibold text-rose-700 hover:underline">
          {t('mapClearPin')}
        </button>
      )}
    </div>
  )
}
