import { Link } from 'react-router-dom'
import { StarIcon } from '@heroicons/react/24/solid'
import {
  buildGuideExperienceA11yLabel,
  getGuideRatingPresentation,
  type GuideRatingSummaryLike,
} from '../../utils/profileIdentity'

export function ProfileGuideExperience({
  username,
  summary,
  guidedCount,
  reviewsHref,
}: {
  username: string
  summary: GuideRatingSummaryLike
  guidedCount: number
  /** Ako postoji reviews ruta — Link; inače informativni blok. */
  reviewsHref?: string | null
}) {
  const presentation = getGuideRatingPresentation(summary)
  const a11y = buildGuideExperienceA11yLabel({
    hasRatings: presentation.hasRatings,
    averageLabel: presentation.averageLabel,
    reviewCount: presentation.reviewCount,
    guidedCount,
  })

  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800/80">
        Vodičko iskustvo
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <StarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          {presentation.hasRatings && presentation.averageLabel ? (
            <span className="text-sm font-extrabold tabular-nums text-gray-900">
              {presentation.averageLabel} ({presentation.reviewCount})
            </span>
          ) : (
            <span className="text-sm font-semibold text-gray-500">{presentation.emptyLabel}</span>
          )}
        </span>
        {guidedCount > 0 ? (
          <span className="text-sm text-gray-600 tabular-nums">
            <span className="font-extrabold text-gray-900">{guidedCount}</span>
            {' '}
            {guidedCount === 1 ? 'vođena tura' : 'vođenih tura'}
          </span>
        ) : null}
      </div>
    </>
  )

  const shellClass =
    'rounded-2xl border border-emerald-100/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

  if (reviewsHref) {
    return (
      <Link
        to={reviewsHref}
        className={`${shellClass} block transition hover:border-emerald-200 hover:bg-emerald-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2`}
        aria-label={a11y}
        data-testid="profile-guide-experience"
      >
        {body}
      </Link>
    )
  }

  return (
    <div
      className={shellClass}
      role="group"
      aria-label={a11y}
      data-testid="profile-guide-experience"
    >
      {body}
      <span className="sr-only">{username}</span>
    </div>
  )
}
