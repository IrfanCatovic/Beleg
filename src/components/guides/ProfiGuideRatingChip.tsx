import { Link } from 'react-router-dom'
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { useTranslation } from 'react-i18next'
import type { GuideRatingSummary } from '../../services/guideRatings'
import { formatGuideRating } from '../ferrate/GuideNearbyCard'

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
      className={`inline-flex items-stretch overflow-hidden rounded-xl border border-amber-200/90 bg-gradient-to-b from-amber-50/90 to-white shadow-sm transition hover:border-amber-300 hover:shadow-md active:scale-[0.99] ${className}`}
      aria-label={t('guideReviewsChipAria', { rating: ratingLabel, count: comments })}
    >
      <span className="inline-flex items-center gap-1.5 px-3 py-2 border-r border-amber-100/90">
        <StarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{ratingLabel}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800/70">{t('guideReviewsRating')}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 px-3 py-2">
        <ChatBubbleLeftEllipsisIcon className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{comments}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700/70">{t('guideReviewsComments')}</span>
      </span>
    </Link>
  )
}
