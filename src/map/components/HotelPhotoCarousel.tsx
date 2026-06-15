import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline'

type TFn = (key: string, opts?: Record<string, unknown>) => string

export function HotelPhotoCarousel({
  photos,
  title,
  t,
}: {
  photos: string[]
  title: string
  t: TFn
}) {
  const list = photos.map((u) => u?.trim()).filter(Boolean)
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  const count = list.length
  const safeIndex = count ? ((index % count) + count) % count : 0
  const current = count ? list[safeIndex] : null

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return
      setIndex((i) => (i + delta + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (!lightbox) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox, go])

  if (!current || count === 0) return null

  const counterLabel = t('mapExplore.popupHotelGalleryCounter', { current: safeIndex + 1, total: count })

  const navBtn = (dir: -1 | 1, className: string, aria: string) =>
    count > 1 ? (
      <button
        type="button"
        className={className}
        aria-label={aria}
        onClick={(e) => {
          e.stopPropagation()
          go(dir)
        }}
      >
        {dir < 0 ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
      </button>
    ) : null

  const lightboxPortal =
    lightbox && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="planiner-hotel-lightbox"
            role="dialog"
            aria-modal
            aria-label={title}
            onClick={(e) => {
              if (e.target === e.currentTarget) setLightbox(false)
            }}
          >
            <button
              type="button"
              className="planiner-hotel-lightbox-close"
              onClick={() => setLightbox(false)}
              aria-label={t('modalClose')}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {navBtn(-1, 'planiner-hotel-lightbox-nav planiner-hotel-lightbox-nav--prev', t('detailGalleryPrev'))}
            {navBtn(1, 'planiner-hotel-lightbox-nav planiner-hotel-lightbox-nav--next', t('detailGalleryNext'))}

            <div className="planiner-hotel-lightbox-frame">
              <img
                key={current}
                src={current}
                alt={`${title} — ${safeIndex + 1}`}
                className="planiner-hotel-lightbox-img"
              />
              {count > 1 && <p className="planiner-hotel-lightbox-counter">{counterLabel}</p>}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div className="planiner-hotel-carousel planiner-map-popup-stagger planiner-map-popup-stagger-1">
        <button
          type="button"
          className="planiner-hotel-carousel-stage"
          onClick={() => setLightbox(true)}
          aria-label={t('mapExplore.popupHotelGalleryEnlarge')}
        >
          <img
            key={current}
            src={current}
            alt={`${title} — ${safeIndex + 1}`}
            className="planiner-hotel-carousel-img"
            loading="lazy"
            decoding="async"
          />
          <span className="planiner-hotel-carousel-shade" aria-hidden />
          <span className="planiner-hotel-carousel-expand" aria-hidden>
            <ArrowsPointingOutIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('mapExplore.popupHotelGalleryEnlarge')}</span>
          </span>
          {count > 1 && <span className="planiner-hotel-carousel-counter">{counterLabel}</span>}
        </button>

        {navBtn(-1, 'planiner-hotel-carousel-nav planiner-hotel-carousel-nav--prev', t('detailGalleryPrev'))}
        {navBtn(1, 'planiner-hotel-carousel-nav planiner-hotel-carousel-nav--next', t('detailGalleryNext'))}

        {count > 1 && (
          <div className="planiner-hotel-carousel-dots" role="tablist" aria-label={title}>
            {list.map((_, i) => (
              <button
                key={`dot-${i}`}
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                aria-label={`${i + 1} / ${count}`}
                className={`planiner-hotel-carousel-dot${i === safeIndex ? ' planiner-hotel-carousel-dot--active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
      {lightboxPortal}
    </>
  )
}
