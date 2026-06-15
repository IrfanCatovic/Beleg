import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import maplibregl from 'maplibre-gl'
import { Marker, Popup, type MapRef } from 'react-map-gl/maplibre'
import { PlusIcon, CalendarDaysIcon, ArrowTopRightOnSquareIcon, PhoneIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { isApprovedProfiGuide } from '../../services/guideProfiles'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { FerrataMarkerElement } from '../../map/markers/FerrataMarkerElement'
import { HotelMarkerElement } from '../../map/markers/HotelMarkerElement'
import { FerrataGuideBookingModal } from '../../components/ferrate/FerrataGuideBookingModal'

const DEFAULT_CENTER = { longitude: 21.0059, latitude: 44.0165, zoom: 6.2 }

type FerrataPin = {
  id: number
  slug: string
  naziv: string
  podrucje: string
  tezina: string
  lat: number
  lng: number
}

type HotelPin = {
  id: number
  naziv: string
  telefon: string
  bookingUrl: string
  instagramUrl: string
  lat: number
  lng: number
}

type ActivePopup = { kind: 'ferrata' | 'hotel'; id: number } | null

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function difficultyBadgeClass(tezina: string) {
  const s = (tezina || '').toUpperCase()
  if (s.includes('E')) return 'bg-zinc-900 text-white border-zinc-800'
  if (s.includes('D')) return 'bg-rose-600 text-white border-rose-700'
  if (s.includes('C')) return 'bg-amber-500 text-white border-amber-600'
  if (s.includes('B')) return 'bg-sky-600 text-white border-sky-700'
  if (s.includes('A')) return 'bg-emerald-600 text-white border-emerald-700'
  return 'bg-slate-600 text-white border-slate-700'
}

export default function MapaExplore() {
  const { t } = useTranslation('ferrate')
  const { user } = useAuth()
  const mapRef = useRef<MapRef>(null)

  const [ferrate, setFerrate] = useState<FerrataPin[]>([])
  const [hotels, setHotels] = useState<HotelPin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showFerrate, setShowFerrate] = useState(true)
  const [showHotels, setShowHotels] = useState(true)
  const [activePopup, setActivePopup] = useState<ActivePopup>(null)
  const [bookingFerrata, setBookingFerrata] = useState<FerrataPin | null>(null)
  const [canCreateGuideAction, setCanCreateGuideAction] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [fRes, hRes] = await Promise.all([api.get('/api/ferratas'), api.get('/api/hotels')])
        if (cancelled) return
        const fRows = (fRes.data?.ferrate ?? []) as Array<Record<string, unknown>>
        const hRows = (hRes.data?.hotels ?? []) as Array<Record<string, unknown>>

        const fPins: FerrataPin[] = []
        for (const r of fRows) {
          const lat = toFiniteNumber(r.lat)
          const lng = toFiniteNumber(r.lng)
          if (lat == null || lng == null) continue
          fPins.push({
            id: Number(r.id),
            slug: String(r.slug ?? ''),
            naziv: String(r.naziv ?? ''),
            podrucje: String(r.podrucje ?? ''),
            tezina: String(r.tezina ?? ''),
            lat,
            lng,
          })
        }

        const hPins: HotelPin[] = []
        for (const r of hRows) {
          const lat = toFiniteNumber(r.lat)
          const lng = toFiniteNumber(r.lng)
          if (lat == null || lng == null) continue
          hPins.push({
            id: Number(r.id),
            naziv: String(r.naziv ?? ''),
            telefon: String(r.telefon ?? ''),
            bookingUrl: String(r.bookingUrl ?? ''),
            instagramUrl: String(r.instagramUrl ?? ''),
            lat,
            lng,
          })
        }

        setFerrate(fPins)
        setHotels(hPins)
      } catch {
        if (!cancelled) setError(t('mapExplore.error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!user) {
      setCanCreateGuideAction(false)
      return
    }
    let cancelled = false
    void isApprovedProfiGuide()
      .then((ok) => {
        if (!cancelled) setCanCreateGuideAction(ok)
      })
      .catch(() => {
        if (!cancelled) setCanCreateGuideAction(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const visibleFerrate = showFerrate ? ferrate : []
  const visibleHotels = showHotels ? hotels : []

  const boundsKey = useMemo(
    () =>
      [
        showFerrate ? visibleFerrate.map((m) => m.id).join(',') : '',
        showHotels ? visibleHotels.map((m) => m.id).join(',') : '',
      ].join('|'),
    [showFerrate, showHotels, visibleFerrate, visibleHotels],
  )

  const fitMarkers = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const pts: Array<[number, number]> = [
      ...visibleFerrate.map((m) => [m.lng, m.lat] as [number, number]),
      ...visibleHotels.map((m) => [m.lng, m.lat] as [number, number]),
    ]
    if (pts.length === 0) {
      map.jumpTo({ center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude], zoom: DEFAULT_CENTER.zoom })
      return
    }
    if (pts.length === 1) {
      map.jumpTo({ center: pts[0], zoom: 11 })
      return
    }
    const b = new maplibregl.LngLatBounds()
    for (const p of pts) b.extend(p)
    map.fitBounds(b, { padding: 64, maxZoom: 12, duration: 400 })
  }, [visibleFerrate, visibleHotels])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const run = () => fitMarkers()
    if (map.isStyleLoaded()) run()
    else map.once('load', run)
    return () => {
      map.off('load', run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, loading])

  const activeFerrata =
    activePopup?.kind === 'ferrata' ? ferrate.find((f) => f.id === activePopup.id) : undefined
  const activeHotel = activePopup?.kind === 'hotel' ? hotels.find((h) => h.id === activePopup.id) : undefined

  const totalPins = ferrate.length + hotels.length

  const chipBase =
    'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-sm transition active:scale-[0.97] sm:text-sm'

  return (
    <div className="relative left-1/2 -mt-6 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden">
      <div className="relative h-[calc(100dvh-3.75rem)] min-h-[460px] w-full bg-slate-100">
        {/* Header overlay: naslov + layer chips */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
          <div className="pointer-events-auto mx-auto flex max-w-5xl flex-col gap-2.5 rounded-2xl border border-emerald-100/80 bg-white/90 px-3.5 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-emerald-900 sm:text-lg">
                <span aria-hidden>⛰️</span>
                <span className="truncate">{t('mapExplore.title')}</span>
              </h1>
              <p className="mt-0.5 hidden text-xs text-gray-500 sm:block">{t('mapExplore.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFerrate((v) => !v)}
                aria-pressed={showFerrate}
                className={`${chipBase} ${
                  showFerrate
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700" />
                {t('mapExplore.layerFerrate')}
                <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">
                  {ferrate.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowHotels((v) => !v)}
                aria-pressed={showHotels}
                className={`${chipBase} ${
                  showHotels
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-300 to-orange-600" />
                {t('mapExplore.layerHotels')}
                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                  {hotels.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Stanja */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-gray-600 shadow">
              {t('mapExplore.loading')}
            </p>
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
            <p className="rounded-xl bg-white/95 px-4 py-3 text-sm font-medium text-rose-600 shadow">{error}</p>
          </div>
        )}
        {!loading && !error && totalPins === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
            <div className="max-w-sm rounded-2xl bg-white/95 px-6 py-5 shadow">
              <p className="text-2xl" aria-hidden>
                🗺️
              </p>
              <p className="mt-2 text-sm font-bold text-gray-800">{t('mapExplore.emptyTitle')}</p>
              <p className="mt-1 text-xs text-gray-500">{t('mapExplore.emptyBody')}</p>
            </div>
          </div>
        )}

        <PlaninerMapFrame
          ref={mapRef}
          className="h-full w-full"
          initialViewState={DEFAULT_CENTER}
          showZoomControls
        >
          {visibleFerrate.map((m) => (
            <Marker
              key={`f-${m.id}`}
              longitude={m.lng}
              latitude={m.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setActivePopup((p) => (p?.kind === 'ferrata' && p.id === m.id ? null : { kind: 'ferrata', id: m.id }))
              }}
            >
              <div className="touch-manipulation" role="presentation">
                <FerrataMarkerElement />
              </div>
            </Marker>
          ))}

          {visibleHotels.map((m) => (
            <Marker
              key={`h-${m.id}`}
              longitude={m.lng}
              latitude={m.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setActivePopup((p) => (p?.kind === 'hotel' && p.id === m.id ? null : { kind: 'hotel', id: m.id }))
              }}
            >
              <div className="touch-manipulation" role="presentation">
                <HotelMarkerElement />
              </div>
            </Marker>
          ))}

          {activeFerrata && (
            <Popup
              longitude={activeFerrata.lng}
              latitude={activeFerrata.lat}
              anchor="bottom"
              offset={20}
              onClose={() => setActivePopup(null)}
              closeButton
              closeOnClick={false}
              maxWidth="280px"
            >
              <div className="min-w-[12rem] space-y-2.5 p-1 text-sm">
                <div>
                  <p className="font-bold leading-snug text-gray-900">{activeFerrata.naziv}</p>
                  {activeFerrata.podrucje?.trim() && (
                    <p className="mt-0.5 text-xs text-gray-500">{activeFerrata.podrucje}</p>
                  )}
                </div>
                {activeFerrata.tezina?.trim() && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-lg border px-2 py-0.5 text-[11px] font-bold ${difficultyBadgeClass(activeFerrata.tezina)}`}
                    >
                      {activeFerrata.tezina}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {t('mapExplore.popupFerrataDifficulty')}
                    </span>
                  </div>
                )}
                <div className="space-y-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setBookingFerrata(activeFerrata)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <CalendarDaysIcon className="h-4 w-4" />
                    {t('mapExplore.popupBookAction')}
                  </button>
                  {canCreateGuideAction && (
                    <Link
                      to={`/dodaj-akciju?tip=via_ferrata&ferrata_id=${activeFerrata.id}&organizator=vodic`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t('mapExplore.popupCreateAction')}
                    </Link>
                  )}
                  {activeFerrata.slug && (
                    <Link
                      to={`/ferate/${activeFerrata.slug}`}
                      className="inline-flex w-full items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:text-emerald-700"
                    >
                      {t('mapExplore.popupDetails')}
                    </Link>
                  )}
                </div>
              </div>
            </Popup>
          )}

          {activeHotel && (
            <Popup
              longitude={activeHotel.lng}
              latitude={activeHotel.lat}
              anchor="bottom"
              offset={20}
              onClose={() => setActivePopup(null)}
              closeButton
              closeOnClick={false}
              maxWidth="280px"
            >
              <div className="min-w-[12rem] space-y-2.5 p-1 text-sm">
                <div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    {t('mapExplore.popupHotelBadge')}
                  </span>
                  <p className="mt-1 font-bold leading-snug text-gray-900">{activeHotel.naziv}</p>
                </div>
                {activeHotel.telefon?.trim() && (
                  <a
                    href={`tel:${activeHotel.telefon.trim()}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-amber-700"
                  >
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {activeHotel.telefon}
                  </a>
                )}
                {(activeHotel.bookingUrl?.trim() || activeHotel.instagramUrl?.trim()) && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {activeHotel.bookingUrl?.trim() && (
                      <a
                        href={activeHotel.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        {t('mapExplore.popupBooking')}
                      </a>
                    )}
                    {activeHotel.instagramUrl?.trim() && (
                      <a
                        href={activeHotel.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-50"
                      >
                        {t('mapExplore.popupInstagram')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          )}
        </PlaninerMapFrame>
      </div>

      {bookingFerrata && (
        <FerrataGuideBookingModal
          open={bookingFerrata != null}
          onClose={() => setBookingFerrata(null)}
          ferrataId={bookingFerrata.id}
          ferrataSlug={bookingFerrata.slug}
          ferrataName={bookingFerrata.naziv}
          ferrataLocation={bookingFerrata.podrucje}
          ferrataLat={bookingFerrata.lat}
          ferrataLng={bookingFerrata.lng}
        />
      )}
    </div>
  )
}
