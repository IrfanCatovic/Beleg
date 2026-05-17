import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { Marker, type MapRef } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { geocoding } from '../../services/geocoding'
import type { GeocodeResult } from '../../services/geocoding/types'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { useDebounce } from '../../hooks/useDebounce'

const DEFAULT_CENTER = { longitude: 21.0059, latitude: 44.0165, zoom: 6.2 }
const MIN_QUERY_LEN = 2
const DEBOUNCE_MS = 420

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function resultTitle(r: GeocodeResult): string {
  if (r.city) return r.city
  const parts = r.label.split(',').map((p) => p.trim()).filter(Boolean)
  return parts[0] || r.label
}

function resultSubtitle(r: GeocodeResult): string | null {
  const sub = [r.region, r.country].filter(Boolean).join(' · ')
  return sub || null
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
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [geoErr, setGeoErr] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS)

  const latNum = parseCoord(props.baseLat)
  const lngNum = parseCoord(props.baseLng)
  const hasPin = latNum != null && lngNum != null
  const hasSelection = Boolean(props.grad.trim() || props.region.trim() || props.drzava.trim() || hasPin)

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
      setGeoErr('')
      setDropdownOpen(false)
      setActiveIndex(-1)
    },
    [props, setPin],
  )

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      setPin(e.lngLat.lat, e.lngLat.lng)
    },
    [setPin],
  )

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (q.length < MIN_QUERY_LEN) {
      setResults([])
      setGeoErr('')
      setLoading(false)
      setActiveIndex(-1)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    setGeoErr('')

    void geocoding
      .search(q, ac.signal)
      .then((list) => {
        if (ac.signal.aborted) return
        setResults(list)
        setActiveIndex(list.length > 0 ? 0 : -1)
        setGeoErr(list.length === 0 ? t('step2.mapGeocodeEmpty') : '')
        setDropdownOpen(true)
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setResults([])
        setActiveIndex(-1)
        if (err instanceof DOMException && err.name === 'AbortError') return
        setGeoErr(t('step2.mapGeocodeError'))
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [debouncedQuery, t])

  useEffect(() => {
    if (!dropdownOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [dropdownOpen])

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

  const inp =
    'w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25 outline-none transition'
  const lbl = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500'

  const showDropdown =
    dropdownOpen &&
    query.trim().length >= MIN_QUERY_LEN &&
    (loading || results.length > 0 || Boolean(geoErr))

  const trimmedQuery = query.trim()
  const showMinCharsHint = dropdownOpen && trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LEN

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-gray-500">{t('step2.hint')}</p>

      <div ref={searchWrapRef} className="relative">
        <label className={lbl} htmlFor="guide-location-search">
          {t('step2.searchLabel')}
        </label>
        <div className="relative mt-0.5">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            id="guide-location-search"
            type="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls="guide-location-suggestions"
            className={inp}
            placeholder={t('step2.mapGeocodePlaceholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setDropdownOpen(true)
              setGeoErr('')
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDropdownOpen(false)
                setActiveIndex(-1)
                return
              }
              if (!showDropdown || results.length === 0) {
                if (e.key === 'Enter') e.preventDefault()
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => (i + 1) % results.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
              } else if (e.key === 'Enter' && activeIndex >= 0) {
                e.preventDefault()
                applyGeocodeResult(results[activeIndex]!)
              }
            }}
          />
          {loading && (
            <span
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
              aria-hidden
            />
          )}
        </div>

        {showMinCharsHint && (
          <p className="mt-1.5 px-1 text-xs text-gray-400">{t('step2.mapGeocodeMinChars')}</p>
        )}

        {showDropdown && (
          <ul
            id="guide-location-suggestions"
            role="listbox"
            className="absolute z-20 mt-1.5 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
          >
            {loading && results.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-gray-500">{t('step2.mapGeocodeLoading')}</li>
            )}
            {!loading && geoErr && results.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-rose-600">{geoErr}</li>
            )}
            {results.map((r, i) => {
              const sub = resultSubtitle(r)
              const active = i === activeIndex
              return (
                <li key={`${r.lat}-${r.lng}-${i}`} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`flex w-full gap-2.5 px-3 py-2.5 text-left transition ${
                      active ? 'bg-emerald-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyGeocodeResult(r)}
                  >
                    <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {resultTitle(r)}
                      </span>
                      {sub && <span className="block truncate text-xs text-gray-500">{sub}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-[10px] text-gray-400">{t('step2.mapGeocodePolicy')}</p>

      {hasSelection && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm">
          <MapPinIcon className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden />
          <span className="text-emerald-900 font-medium">
            {[props.grad, props.region, props.drzava].filter(Boolean).join(', ') || t('step2.pinOnly')}
          </span>
        </div>
        )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>{t('step2.drzava')}</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={props.drzava}
            onChange={(e) => props.onDrzavaChange(e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>{t('step2.region')}</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={props.region}
            onChange={(e) => props.onRegionChange(e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>{t('step2.grad')}</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={props.grad}
            onChange={(e) => props.onGradChange(e.target.value)}
          />
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
