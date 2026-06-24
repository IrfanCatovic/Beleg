import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { TFunction } from 'i18next'
import type { GuideNearbyPublic } from '../../services/guidesPublic'
import { PlaninerIcon } from '../ui/PlaninerIcon'
import { GuideNearbyCard } from './GuideNearbyCard'

const PAGE_SIZE = 5

export function FerrataGuidesAllModal(props: {
  open: boolean
  onClose: () => void
  guides: GuideNearbyPublic[]
  t: TFunction<'ferrate'>
  tGuide: TFunction<'guideProfiles'>
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    if (!props.open) return
    setVisibleCount(PAGE_SIZE)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [props.open, props.guides])

  const visibleGuides = props.guides.slice(0, visibleCount)
  const hasMore = visibleCount < props.guides.length

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore) return
      const el = e.currentTarget
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceFromBottom <= 24) {
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, props.guides.length))
      }
    },
    [hasMore, props.guides.length],
  )

  if (!props.open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="ferrata-guides-all-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div className="flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-100 bg-white pb-[max(0px,env(safe-area-inset-bottom))] shadow-xl sm:max-h-[min(85vh,640px)] sm:rounded-2xl sm:pb-0">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <PlaninerIcon name="guide" variant="solid" />
            <div className="min-w-0">
              <h3 id="ferrata-guides-all-title" className="text-base font-bold leading-tight text-gray-900 sm:text-lg">
                {props.t('detailLocalGuidesTitle')}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {props.t('detailGuidesModalCount', { count: props.guides.length })}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            onClick={props.onClose}
            aria-label={props.t('modalClose')}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
          <p className="mb-3 text-xs text-gray-500">{props.t('detailGuidesScrollHint')}</p>
          <div
            className="max-h-[min(42dvh,20.5rem)] touch-pan-y overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch] sm:max-h-[min(50vh,24rem)]"
            onScroll={handleScroll}
          >
            <ul className="grid min-w-0 gap-3">
              {visibleGuides.map((g) => (
                <GuideNearbyCard key={g.id} guide={g} t={props.t} tGuide={props.tGuide} />
              ))}
            </ul>
            {hasMore && (
              <p className="py-3 text-center text-xs text-gray-400" aria-hidden>
                …
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
