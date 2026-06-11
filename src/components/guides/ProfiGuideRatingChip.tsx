import { Link } from 'react-router-dom'
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { useTranslation } from 'react-i18next'
import type { GuideRatingSummary } from '../../services/guideRatings'
import { formatGuideRating } from '../ferrate/GuideNearbyCard'

const chipClassName =
  'inline-flex items-center gap-2.5 rounded-xl border border-gray-200/90 bg-white px-3 py-2 shadow-sm'

export function ProfiGuideRatingBadge(props: {
  summary: GuideRatingSummary
  className?: string
}) {
  const hasRating = (props.summary.brojOcena ?? 0) > 0
  const ratingLabel = hasRating ? formatGuideRating(props.summary.prosecnaOcena) : '-'
  const comments = props.summary.brojKomentara ?? 0

  return (
    <span className={`${chipClassName} ${props.className ?? ''}`}>
      <span className="inline-flex items-center gap-1">
        <StarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{ratingLabel}</span>
      </span>
      <span className="h-4 w-px bg-gray-200" aria-hidden />
      <span className="inline-flex items-center gap-1">
        <ChatBubbleLeftEllipsisIcon className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{comments}</span>
      </span>
    </span>
  )
}

export function ProfiGuideRatingChip(props: {
  username: string
  summary: GuideRatingSummary
  className?: string
}) {
  const { t } = useTranslation('userProfile')
  const { username, summary, className = '' } = props
  const hasRating = (summary.brojOcena ?? 0) > 0
  const ratingLabel = hasRating ? formatGuideRating(summary.prosecnaOcena) : '-'
  const comments = summary.brojKomentara ?? 0

  return (
    <Link
      to={`/korisnik/${encodeURIComponent(username)}/recenzije`}
      className={`${chipClassName} transition hover:border-emerald-200 hover:bg-emerald-50/40 active:scale-[0.99] ${className}`}
      aria-label={t('guideReviewsChipAria', { rating: ratingLabel, count: comments })}
    >
      <span className="inline-flex items-center gap-1">
        <StarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{ratingLabel}</span>
      </span>
      <span className="h-4 w-px bg-gray-200" aria-hidden />
      <span className="inline-flex items-center gap-1">
        <ChatBubbleLeftEllipsisIcon className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{comments}</span>
      </span>
    </Link>
  )
}
