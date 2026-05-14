import { useId, useMemo, useState } from 'react'
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, HomeModernIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { FerrataDetailMapCard } from './FerrataDetailMapCard'
import { normalizeInstagramUrl, safeHttpUrl } from './smestajExternalUrls'

export type SmestajPublic = {
  naziv: string
  opis: string
  slike: string[]
  lat?: number | null
  lng?: number | null
  bookingUrl?: string
  instagramUrl?: string
}

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

function smestajThumb(s: SmestajPublic): string | null {
  const u = s.slike?.find((x) => x?.trim())
  return u?.trim() ?? null
}

export function FerrataSmestajSection(props: { items: SmestajPublic[] }) {
  const { t } = useTranslation('ferrate')
  const [open, setOpen] = useState<number | null>(null)
  const list = useMemo(
    () =>
      props.items.filter((x) => {
        const hasText = x.naziv?.trim() || x.opis?.trim()
        const hasImg = (x.slike?.length ?? 0) > 0
        const hasPin = x.lat != null && x.lng != null && Number.isFinite(x.lat) && Number.isFinite(x.lng)
        const hasLinks = (x.bookingUrl ?? '').trim() || (x.instagramUrl ?? '').trim()
        return hasText || hasImg || hasPin || hasLinks
      }),
    [props.items],
  )
  if (list.length === 0) return null
  const active = open != null ? list[open] : null
  const hasCoords = active && active.lat != null && active.lng != null && Number.isFinite(active.lat) && Number.isFinite(active.lng)
  const bookingHref = active ? safeHttpUrl(active.bookingUrl) : null
  const instagramHref = active ? normalizeInstagramUrl(active.instagramUrl) : null

  return (
    <>
      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-emerald-700">{t('detailSmestajTitle')}</h2>
        <ul className="grid gap-3">
          {list.map((s, i) => {
            const thumb = smestajThumb(s)
            const title = s.naziv.trim() || t('detailSmestajUnnamed')
            return (
              <li key={`${title}-${i}-${thumb ?? ''}`}>
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  className="group flex w-full gap-3 overflow-hidden rounded-xl border border-emerald-100/90 bg-white text-left shadow-sm ring-1 ring-black/[0.02] transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="relative h-24 w-28 shrink-0 bg-gradient-to-br from-slate-100 to-emerald-50/50">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-emerald-300">
                        <HomeModernIcon className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3">
                    <p className="truncate text-sm font-bold text-gray-900 group-hover:text-emerald-900">{title}</p>
                    {s.opis?.trim() && <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{s.opis.trim()}</p>}
                    <span className="mt-1.5 text-[11px] font-semibold text-emerald-700">{t('detailSmestajOpenHint')} →</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </article>

      {active && open != null && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null)
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <h3 className="text-base font-bold text-gray-900">{active.naziv.trim() || t('detailSmestajUnnamed')}</h3>
              <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={() => setOpen(null)} aria-label={t('modalClose')}>
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {active.slike?.length > 0 && <SmestajCarousel urls={active.slike} />}
              {active.opis?.trim() && <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{active.opis.trim()}</p>}
              {(instagramHref || bookingHref) && (
                <div className="flex flex-wrap items-center gap-2">
                  {instagramHref && (
                    <a
                      href={instagramHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-pink-100 bg-white shadow-sm transition hover:ring-2 hover:ring-pink-200"
                      aria-label={t('detailSmestajInstagramAria')}
                    >
                      <InstagramGlyph className="h-7 w-7" />
                    </a>
                  )}
                  {bookingHref && (
                    <a
                      href={bookingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
                      aria-label={t('detailSmestajBookingAria')}
                    >
                      <CalendarDaysIcon className="h-5 w-5 shrink-0" />
                      {t('detailSmestajBooking')}
                    </a>
                  )}
                </div>
              )}
              {hasCoords && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <MapPinIcon className="h-4 w-4" />
                    {t('detailSmestajMapHint')}
                  </p>
                  <div className="overflow-hidden rounded-xl ring-1 ring-emerald-900/10">
                    <FerrataDetailMapCard embed lat={active.lat!} lng={active.lng!} naziv={active.naziv} subtitle="" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SmestajCarousel(props: { urls: string[] }) {
  const [ix, setIx] = useState(0)
  const u = props.urls[ix % props.urls.length]
  if (!u) return null
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="rounded-lg border border-gray-200 p-2" onClick={() => setIx((i) => (i - 1 + props.urls.length) % props.urls.length)}>
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <div className="h-48 flex-1 overflow-hidden rounded-xl bg-gray-100">
        <img src={u} alt="" className="h-full w-full object-cover" />
      </div>
      <button type="button" className="rounded-lg border border-gray-200 p-2" onClick={() => setIx((i) => (i + 1) % props.urls.length)}>
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
