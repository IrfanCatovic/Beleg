import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'

type Props = {
  urls: string[]
  /** Naslov ferate — za alt / lightbox. */
  naziv: string
}

export function FerrataDetailGallery(props: Props) {
  const { t } = useTranslation('ferrate')
  const list = props.urls.map((u) => u.trim()).filter(Boolean)
  const [open, setOpen] = useState<number | null>(null)

  const safeIx = open != null && list.length ? ((open % list.length) + list.length) % list.length : 0
  const current = open != null ? list[safeIx] : null

  const go = useCallback(
    (delta: number) => {
      if (list.length === 0) return
      setOpen((i) => {
        if (i == null) return 0
        return (i + delta + list.length) % list.length
      })
    },
    [list.length],
  )

  useEffect(() => {
    if (open == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go])

  if (list.length === 0) return null

  return (
    <>
      <section className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-emerald-50/30 p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <PhotoIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-800">{t('detailGalleryTitle')}</h2>
            <p className="text-[11px] text-gray-500">{t('detailGalleryHint')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {list.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setOpen(i)}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-200 ring-1 ring-emerald-900/10 transition hover:ring-2 hover:ring-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <img src={url} alt={`${props.naziv} — ${i + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" loading="lazy" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </section>

      {current != null && open != null && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-label={t('detailGalleryTitle')}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null)
          }}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setOpen(null)}
            aria-label={t('modalClose')}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          {list.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6"
                onClick={() => go(-1)}
                aria-label={t('detailGalleryPrev')}
              >
                <ChevronLeftIcon className="h-7 w-7" />
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6"
                onClick={() => go(1)}
                aria-label={t('detailGalleryNext')}
              >
                <ChevronRightIcon className="h-7 w-7" />
              </button>
            </>
          )}
          <div className="max-h-[88vh] max-w-5xl">
            <img
              src={current}
              alt={`${props.naziv} — ${safeIx + 1}`}
              className="max-h-[82vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
            {list.length > 1 && (
              <p className="mt-3 text-center text-xs font-semibold text-white/80">
                {safeIx + 1} / {list.length}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
