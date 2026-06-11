import { useEffect, useId, useMemo, useState } from 'react'
import {
  CalendarDaysIcon,
  HomeModernIcon,
  MapPinIcon,
  PhoneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { PlaninerIcon } from '../ui/PlaninerIcon'
import { ferrataDetailCardClass } from './ferrataDetailCardStyles'
import { FerrataDetailMapCard } from './FerrataDetailMapCard'
import { HotelNearbyCard } from './HotelNearbyCard'
import { normalizeInstagramUrl, safeHttpUrl } from './smestajExternalUrls'

export type HotelNearbyPublic = {
  id: number
  naziv: string
  slug: string
  lat: number
  lng: number
  opis?: string
  telefon?: string
  slike?: string[]
  bookingUrl?: string
  instagramUrl?: string
  distanceKm?: number
}

export type FerrataHotelsVariant = 'full' | 'sidebar'

function InstagramGlyph(props: { className?: string }) {
  const gid = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="50%" stopColor="#e6683c" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${gid})`} />
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="17" cy="7" r="1.2" fill="white" />
    </svg>
  )
}

function formatDistanceKm(km: number | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—'
  const rounded = Math.round(km * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

export function FerrataHotelsSection(props: {
  ferrataLat: number
  ferrataLng: number
  /** Puna lista ispod mape kada nema bloka „Zašto ići“. */
  variant?: FerrataHotelsVariant
}) {
  const { t } = useTranslation('ferrate')
  const variant = props.variant ?? 'full'
  const [rows, setRows] = useState<HotelNearbyPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [openIx, setOpenIx] = useState<number | null>(null)
  const [imgIx, setImgIx] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const res = await api.get<{ hotels?: HotelNearbyPublic[] }>('/api/hotels/nearby', {
          params: { lat: props.ferrataLat, lng: props.ferrataLng, radius_km: 100, limit: 30 },
        })
        if (!cancelled) setRows((res.data?.hotels as HotelNearbyPublic[]) ?? [])
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [props.ferrataLat, props.ferrataLng])

  useEffect(() => {
    setExpanded(false)
  }, [props.ferrataLat, props.ferrataLng])

  const list = useMemo(
    () =>
      rows.filter((h) => {
        const pin = Number.isFinite(h.lat) && Number.isFinite(h.lng)
        return pin && (h.naziv?.trim() || (h.slike?.length ?? 0) > 0 || (h.opis ?? '').trim() || (h.telefon ?? '').trim())
      }),
    [rows],
  )

  const visibleList = variant === 'sidebar' && !expanded ? list.slice(0, 2) : list

  const active = openIx != null ? list[openIx] : null
  const bookingHref = active ? safeHttpUrl(active.bookingUrl) : null
  const instagramHref = active ? normalizeInstagramUrl(active.instagramUrl) : null
  const urls = active?.slike?.map((x) => x.trim()).filter(Boolean) ?? []
  const mainUrl = urls[imgIx % Math.max(urls.length, 1)] ?? null

  useEffect(() => {
    if (active) setImgIx(0)
  }, [active?.id])

  function renderHotelRows(items: HotelNearbyPublic[], baseIndex: number) {
    return (
      <ul className="grid min-w-0 gap-3">
        {items.map((h, i) => (
          <HotelNearbyCard key={h.id} hotel={h} onOpen={() => setOpenIx(baseIndex + i)} />
        ))}
      </ul>
    )
  }

  const detailModal =
    active && openIx != null ? (
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
        role="dialog"
        aria-modal
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpenIx(null)
        }}
      >
        <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <PlaninerIcon name="stay" variant="solid" />
              <h3 className="text-lg font-bold leading-tight text-gray-900">
                {(active.naziv ?? '').trim() || t('detailHotelUnnamed')}
              </h3>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              onClick={() => setOpenIx(null)}
              aria-label={t('modalClose')}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="flex min-w-0 gap-2 sm:gap-3">
              <div className="relative min-h-[11rem] min-w-0 flex-1 overflow-hidden rounded-xl bg-gray-100 sm:min-h-[14rem]">
                {mainUrl ? (
                  <img src={mainUrl} alt="" className="h-full w-full min-h-[11rem] object-cover sm:min-h-[14rem]" />
                ) : (
                  <div className="flex h-full min-h-[11rem] items-center justify-center text-emerald-200 sm:min-h-[14rem]">
                    <HomeModernIcon className="h-16 w-16" />
                  </div>
                )}
              </div>
              {urls.length > 1 && (
                <div className="flex w-20 shrink-0 flex-col gap-1.5 overflow-y-auto pr-0.5 sm:w-24">
                  {urls.map((u, ix) => (
                    <button
                      key={`${u}-${ix}`}
                      type="button"
                      onClick={() => setImgIx(ix)}
                      className={`relative h-14 w-full shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-16 ${
                        ix === imgIx % urls.length ? 'ring-emerald-600' : 'ring-transparent hover:ring-emerald-200'
                      }`}
                    >
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid min-w-0 gap-5 lg:grid-cols-[1fr_min(280px,100%)] lg:items-start">
              <div className="min-w-0 space-y-2">
                <h4 className="text-sm font-bold text-gray-900">
                  {t('detailHotelAboutTitle', { name: (active.naziv ?? '').trim() || t('detailHotelUnnamed') })}
                </h4>
                {(active.opis ?? '').trim() ? (
                  <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{(active.opis ?? '').trim()}</p>
                ) : (
                  <p className="text-sm text-gray-500">{t('detailHotelNoDescription')}</p>
                )}
              </div>

              <div className="min-w-0 space-y-3 rounded-xl border border-gray-200 bg-gray-50/40 p-4">
                <div className="flex items-start gap-2 text-sm text-gray-800">
                  <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span>{t('detailHotelDistance', { km: formatDistanceKm(active.distanceKm) })}</span>
                </div>
                {(active.telefon ?? '').trim() && (
                  <div className="flex items-start gap-2 text-sm text-gray-800">
                    <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <a href={telHref(active.telefon!)} className="font-medium text-emerald-800 hover:underline">
                      {(active.telefon ?? '').trim()}
                    </a>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  {bookingHref && (
                    <a
                      href={bookingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00897B] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#00796b]"
                    >
                      <CalendarDaysIcon className="h-5 w-5 shrink-0" />
                      {t('detailHotelBookNow')}
                    </a>
                  )}
                  {instagramHref && (
                    <a
                      href={instagramHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-pink-300 bg-white px-4 py-3 text-sm font-bold text-pink-900 shadow-sm transition hover:bg-pink-50/80"
                    >
                      <InstagramGlyph className="h-5 w-5 shrink-0" />
                      {t('detailHotelInstagramProfile')}
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">{t('detailHotelMapSectionTitle')}</p>
              <div className="overflow-hidden rounded-xl ring-1 ring-emerald-900/10">
                <FerrataDetailMapCard
                  embed
                  markerKind="stay"
                  lat={active.lat}
                  lng={active.lng}
                  naziv={(active.naziv ?? '').trim() || t('detailHotelUnnamed')}
                  subtitle=""
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null

  if (variant === 'sidebar') {
    return (
      <>
        <article className={`min-w-0 max-w-full ${ferrataDetailCardClass}`}>
          <div className="mb-4 flex items-center gap-3">
            <PlaninerIcon name="stay" variant="solid" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('detailHotelsTitle')}</h2>
          </div>
          {loading && <p className="text-sm text-gray-500">…</p>}
          {!loading && list.length === 0 && <p className="text-sm text-gray-500">{t('detailHotelsEmpty')}</p>}
          {!loading && list.length > 0 && (
            <>
              {renderHotelRows(visibleList, 0)}
              {list.length > 2 && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/80 py-2.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100/90"
                >
                  {expanded ? t('detailHotelsShowLess') : t('detailHotelsShowAll', { count: list.length })}
                </button>
              )}
            </>
          )}
        </article>
        {detailModal}
      </>
    )
  }

  if (list.length === 0) return null

  return (
    <>
      <article className={`min-w-0 max-w-full ${ferrataDetailCardClass}`}>
        <div className="mb-4 flex items-center gap-3">
          <PlaninerIcon name="stay" variant="solid" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('detailHotelsTitle')}</h2>
        </div>
        {renderHotelRows(list, 0)}
      </article>
      {detailModal}
    </>
  )
}
