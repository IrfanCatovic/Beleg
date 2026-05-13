import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { FerrataDetailMapCard } from './FerrataDetailMapCard'

export type SmestajPublic = {
  naziv: string
  opis: string
  slike: string[]
  lat?: number | null
  lng?: number | null
}

export function FerrataSmestajSection(props: { items: SmestajPublic[] }) {
  const { t } = useTranslation('ferrate')
  const [open, setOpen] = useState<number | null>(null)
  const list = props.items.filter((x) => x.naziv?.trim() || x.opis?.trim() || (x.slike?.length ?? 0) > 0)
  if (list.length === 0) return null
  const active = open != null ? list[open] : null
  const hasCoords = active && active.lat != null && active.lng != null && Number.isFinite(active.lat) && Number.isFinite(active.lng)

  return (
    <>
      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-emerald-700">{t('detailSmestajTitle')}</h2>
        <ul className="space-y-2">
          {list.map((s, i) => (
            <li key={`${s.naziv}-${i}`}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="w-full rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-left text-sm font-bold text-emerald-900 hover:bg-emerald-50"
              >
                {s.naziv.trim() || t('detailSmestajUnnamed')}
              </button>
            </li>
          ))}
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
              {hasCoords && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <MapPinIcon className="h-4 w-4" />
                    {t('detailSmestajMapHint')}
                  </p>
                  <div className="h-56 overflow-hidden rounded-xl ring-1 ring-emerald-900/10">
                    <FerrataDetailMapCard lat={active.lat!} lng={active.lng!} naziv={active.naziv} subtitle="" />
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
