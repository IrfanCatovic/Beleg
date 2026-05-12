import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { LatLng } from 'leaflet'
import { geocoding } from '../../services/geocoding'
import type { GeocodeResult } from '../../services/geocoding/types'
import { ferrataMapTiles } from '../../map/ferrataMapTiles'

const DEFAULT_CENTER: [number, number] = [44.0165, 21.0059]
const DEFAULT_ZOOM = 7

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function MapClickHandler({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng)
    },
  })
  return null
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 12))
  }, [lat, lng, map])
  return null
}

export function FerrataLocationEditor(props: {
  lat: string
  lng: string
  onLatChange: (v: string) => void
  onLngChange: (v: string) => void
}) {
  const { t } = useTranslation('ferrate')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [geoErr, setGeoErr] = useState('')

  const latNum = parseCoord(props.lat)
  const lngNum = parseCoord(props.lng)
  const hasPin = latNum != null && lngNum != null

  const setPin = useCallback(
    (ll: LatLng) => {
      props.onLatChange(ll.lat.toFixed(6))
      props.onLngChange(ll.lng.toFixed(6))
    },
    [props],
  )

  const clearPin = useCallback(() => {
    props.onLatChange('')
    props.onLngChange('')
    setResults([])
    setGeoErr('')
  }, [props])

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    setGeoErr('')
    setLoading(true)
    setResults([])
    try {
      const list = await geocoding.search(q)
      setResults(list)
      if (list.length === 0) setGeoErr(t('mapGeocodeEmpty'))
    } catch {
      setGeoErr(t('mapGeocodeError'))
    } finally {
      setLoading(false)
    }
  }

  const center: [number, number] = hasPin ? [latNum!, lngNum!] : DEFAULT_CENTER
  const zoom = hasPin ? 12 : DEFAULT_ZOOM

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4 mt-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{t('superadminSectionMap')}</h3>
      <p className="text-[11px] text-gray-500 leading-relaxed">{t('mapClickHint')}</p>
      <p className="text-[10px] text-gray-400">{t('mapGeocodePolicy')}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder={t('mapGeocodePlaceholder')}
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
          {loading ? t('mapGeocodeLoading') : t('mapGeocodeSearch')}
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
                onClick={() => {
                  props.onLatChange(r.lat.toFixed(6))
                  props.onLngChange(r.lng.toFixed(6))
                  setResults([])
                  setQuery('')
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">{t('mapLat')}</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={props.lat}
            onChange={(e) => props.onLatChange(e.target.value)}
            inputMode="decimal"
            placeholder="43.527…"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">{t('mapLng')}</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={props.lng}
            onChange={(e) => props.onLngChange(e.target.value)}
            inputMode="decimal"
            placeholder="20.233…"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 ring-1 ring-emerald-900/10 shadow-inner bg-slate-100/80">
        <MapContainer center={center} zoom={zoom} className="z-0 h-72 w-full" scrollWheelZoom preferCanvas>
          <TileLayer
            attribution={ferrataMapTiles.attribution}
            url={ferrataMapTiles.url}
            {...(ferrataMapTiles.maxZoom != null ? { maxZoom: ferrataMapTiles.maxZoom } : {})}
          />
          <MapClickHandler onPick={setPin} />
          {hasPin && <FlyTo lat={latNum!} lng={lngNum!} />}
          {hasPin && (
            <Marker
              position={[latNum!, lngNum!]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng()
                  setPin(ll)
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {hasPin && (
        <button type="button" onClick={clearPin} className="text-xs font-semibold text-rose-700 hover:underline">
          {t('mapClearPin')}
        </button>
      )}
    </div>
  )
}
