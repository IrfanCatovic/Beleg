import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Marker, type MapRef } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { geocoding } from '../../services/geocoding'
import type { GeocodeResult } from '../../services/geocoding/types'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'

const DEFAULT_CENTER = { longitude: 21.0059, latitude: 44.0165, zoom: 6.2 }

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function GuideBaseLocationPicker(props: {
  drzava: string
  region: string
  grad: string
  baseLat: string
  baseLng: string
  onDrzavaChange: (v: string) => void
  onRegionChange: (v: string) => void
  onGradChange: (v: string) => void
  onBaseLatChange: (v: string) => void
  onBaseLngChange: (v: string) => void
}) {
  const { t } = useTranslation('guideProfiles')
  const mapRef = useRef<MapRef>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [geoErr, setGeoErr] = useState('')

  const latNum = parseCoord(props.baseLat)
  const lngNum = parseCoord(props.baseLng)
  const hasPin = latNum != null && lngNum != null

  const setPin = useCallback(
    (lat: number, lng: number) => {
      props.onBaseLatChange(lat.toFixed(6))
      props.onBaseLngChange(lng.toFixed(6))
    },
    [props],
  )

  const applyGeocodeResult = useCallback(
    (r: GeocodeResult) => {
      setPin(r.lat, r.lng)
      if (r.country) props.onDrzavaChange(r.country)
      if (r.region) props.onRegionChange(r.region)
      if (r.city) props.onGradChange(r.city)
      setResults([])
      setQuery('')
    },
    [props, setPin],
  )

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      setPin(e.lngLat.lat, e.lngLat.lng)
    },
    [setPin],
  )

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    setGeoErr('')
    setLoading(true)
    setResults([])
    try {
      const list = await geocoding.search(q)
      setResults(list)
      if (list.length === 0) setGeoErr(t('step2.mapGeocodeEmpty'))
    } catch {
      setGeoErr(t('step2.mapGeocodeError'))
    } finally {
      setLoading(false)
    }
  }

  const initialViewState = hasPin
    ? { longitude: lngNum!, latitude: latNum!, zoom: 12 }
    : DEFAULT_CENTER

  useEffect(() => {
    if (!hasPin) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const run = () => {
      map.easeTo({
        center: [lngNum!, latNum!],
        zoom: Math.max(map.getZoom(), 12),
        duration: 500,
      })
    }
    if (map.isStyleLoaded()) run()
    else map.once('load', run)
    return () => {
      map.off('load', run)
    }
  }, [hasPin, latNum, lngNum])

  const inp = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
  const lbl = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500'

  return (
    <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-gray-500">{t('step2.hint')}</p>
        <p className="text-[10px] text-gray-400">{t('step2.mapGeocodePolicy')}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={`${inp} flex-1`}
            placeholder={t('step2.mapGeocodePlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runSearch()
              }
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void runSearch()}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {loading ? t('step2.mapGeocodeLoading') : t('step2.mapGeocodeSearch')}
          </button>
        </div>
        {geoErr && <p className="text-xs text-rose-600">{geoErr}</p>}
        {results.length > 0 && (
          <ul className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2 text-xs">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-left text-gray-800 hover:bg-white"
                  onClick={() => applyGeocodeResult(r)}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={lbl}>{t('step2.drzava')}</label>
            <input className={inp} value={props.drzava} onChange={(e) => props.onDrzavaChange(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('step2.region')}</label>
            <input className={inp} value={props.region} onChange={(e) => props.onRegionChange(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('step2.grad')}</label>
            <input className={inp} value={props.grad} onChange={(e) => props.onGradChange(e.target.value)} />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-100/80 shadow-inner ring-1 ring-emerald-900/10">
          <div className="relative h-72 w-full">
            <PlaninerMapFrame
              ref={mapRef}
              className="h-full w-full"
              initialViewState={initialViewState}
              onClick={onMapClick}
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
                  <div className="h-8 w-8 -translate-y-1 rounded-full border-2 border-white bg-emerald-500 shadow-lg ring-2 ring-emerald-700/30" />
                </Marker>
              )}
            </PlaninerMapFrame>
          </div>
        </div>
      </div>
  )
}
