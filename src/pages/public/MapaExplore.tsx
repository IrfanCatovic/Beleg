import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import maplibregl from 'maplibre-gl'
import { Marker, type MapRef } from 'react-map-gl/maplibre'
import { fetchExploreMapData } from '../../services/catalog'
import { useAuth } from '../../context/AuthContext'
import { isApprovedProfiGuide } from '../../services/guideProfiles'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { FerrataMapPopup, HotelMapPopup, PeakMapPopup } from '../../map/components/MapExplorePopups'
import { FerrataMarkerElement } from '../../map/markers/FerrataMarkerElement'
import { HotelMarkerElement } from '../../map/markers/HotelMarkerElement'
import { PeakMarkerElement } from '../../map/markers/PeakMarkerElement'
import { FerrataGuideBookingModal } from '../../components/ferrate/FerrataGuideBookingModal'
import { PeakCreateActionModal, type PeakActionPeak } from '../../components/map/PeakCreateActionModal'

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
  slike: string[]
  lat: number
  lng: number
}

type PeakPin = {
  id: number
  naziv: string
  planina: string
  visinaM: number
  drzava: string
  grad: string
  lat: number
  lng: number
}

type ActivePopup = { kind: 'ferrata' | 'hotel' | 'peak'; id: number } | null

const CLUB_ROLES = ['superadmin', 'admin', 'vodic']

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function MapaExplore() {
  const { t } = useTranslation('ferrate')
  const { user } = useAuth()
  const mapRef = useRef<MapRef>(null)

  const [ferrate, setFerrate] = useState<FerrataPin[]>([])
  const [hotels, setHotels] = useState<HotelPin[]>([])
  const [peaks, setPeaks] = useState<PeakPin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showFerrate, setShowFerrate] = useState(true)
  const [showHotels, setShowHotels] = useState(true)
  const [showPeaks, setShowPeaks] = useState(true)
  const [activePopup, setActivePopup] = useState<ActivePopup>(null)
  const [bookingFerrata, setBookingFerrata] = useState<FerrataPin | null>(null)
  const [canCreateGuideAction, setCanCreateGuideAction] = useState(false)
  const [createActionPeak, setCreateActionPeak] = useState<PeakActionPeak | null>(null)

  const canClub = !!user && CLUB_ROLES.includes(user.role)
  const canCreatePeakAction = canClub || canCreateGuideAction

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const { ferratas, hotels, peaks } = await fetchExploreMapData()
        if (cancelled) return
        const fRows = (ferratas?.ferrate ?? []) as Array<Record<string, unknown>>
        const hRows = (hotels?.hotels ?? []) as Array<Record<string, unknown>>
        const pRows = (peaks?.peaks ?? []) as Array<Record<string, unknown>>

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
            slike: Array.isArray(r.slike)
              ? (r.slike as unknown[]).map((u) => String(u ?? '').trim()).filter(Boolean)
              : [],
            lat,
            lng,
          })
        }

        const pPins: PeakPin[] = []
        for (const r of pRows) {
          const lat = toFiniteNumber(r.lat)
          const lng = toFiniteNumber(r.lng)
          if (lat == null || lng == null) continue
          pPins.push({
            id: Number(r.id),
            naziv: String(r.naziv ?? ''),
            planina: String(r.planina ?? ''),
            visinaM: toFiniteNumber(r.visinaM) ?? 0,
            drzava: String(r.drzava ?? ''),
            grad: String(r.grad ?? ''),
            lat,
            lng,
          })
        }

        setFerrate(fPins)
        setHotels(hPins)
        setPeaks(pPins)
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
  const visiblePeaks = showPeaks ? peaks : []

  const boundsKey = useMemo(
    () =>
      [
        showFerrate ? visibleFerrate.map((m) => m.id).join(',') : '',
        showHotels ? visibleHotels.map((m) => m.id).join(',') : '',
        showPeaks ? visiblePeaks.map((m) => m.id).join(',') : '',
      ].join('|'),
    [showFerrate, showHotels, showPeaks, visibleFerrate, visibleHotels, visiblePeaks],
  )

  const fitMarkers = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const pts: Array<[number, number]> = [
      ...visibleFerrate.map((m) => [m.lng, m.lat] as [number, number]),
      ...visibleHotels.map((m) => [m.lng, m.lat] as [number, number]),
      ...visiblePeaks.map((m) => [m.lng, m.lat] as [number, number]),
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
  }, [visibleFerrate, visibleHotels, visiblePeaks])

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
  const activePeak = activePopup?.kind === 'peak' ? peaks.find((p) => p.id === activePopup.id) : undefined

  const totalPins = ferrate.length + hotels.length + peaks.length

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
              <button
                type="button"
                onClick={() => setShowPeaks((v) => !v)}
                aria-pressed={showPeaks}
                className={`${chipBase} ${
                  showPeaks
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                    : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-sky-300 to-indigo-700" />
                {t('mapExplore.layerPeaks')}
                <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-700">
                  {peaks.length}
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
                <FerrataMarkerElement active={activePopup?.kind === 'ferrata' && activePopup.id === m.id} />
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
                <HotelMarkerElement active={activePopup?.kind === 'hotel' && activePopup.id === m.id} />
              </div>
            </Marker>
          ))}

          {visiblePeaks.map((m) => (
            <Marker
              key={`p-${m.id}`}
              longitude={m.lng}
              latitude={m.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setActivePopup((p) => (p?.kind === 'peak' && p.id === m.id ? null : { kind: 'peak', id: m.id }))
              }}
            >
              <div className="touch-manipulation" role="presentation">
                <PeakMarkerElement active={activePopup?.kind === 'peak' && activePopup.id === m.id} />
              </div>
            </Marker>
          ))}

          {activeFerrata && (
            <FerrataMapPopup
              ferrata={activeFerrata}
              onClose={() => setActivePopup(null)}
              onBook={() => setBookingFerrata(activeFerrata)}
              canCreateGuideAction={canCreateGuideAction}
              t={t}
            />
          )}

          {activeHotel && <HotelMapPopup hotel={activeHotel} onClose={() => setActivePopup(null)} t={t} />}

          {activePeak && (
            <PeakMapPopup
              peak={activePeak}
              onClose={() => setActivePopup(null)}
              onCreateAction={() =>
                setCreateActionPeak({
                  id: activePeak.id,
                  naziv: activePeak.naziv,
                  planina: activePeak.planina,
                })
              }
              canCreatePeakAction={canCreatePeakAction}
              t={t}
            />
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

      <PeakCreateActionModal
        open={createActionPeak != null}
        onClose={() => setCreateActionPeak(null)}
        peak={createActionPeak}
        canClub={canClub}
        canGuide={canCreateGuideAction}
      />
    </div>
  )
}
