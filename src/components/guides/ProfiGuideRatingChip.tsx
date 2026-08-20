import { Link } from 'react-router-dom'
import { StarIcon } from '@heroicons/react/24/solid'
import { useTranslation } from 'react-i18next'
import type { GuideRatingSummary } from '../../services/guideRatings'
import { getGuideRatingPresentation } from '../../utils/profileIdentity'

const chipClassName =
  'inline-flex items-center gap-1.5 rounded-xl border border-gray-200/90 bg-white px-3 py-2 shadow-sm'

function ratingChipLabel(summary: GuideRatingSummary): string {
  const presentation = getGuideRatingPresentation(summary)
  if (presentation.hasRatings && presentation.averageLabel) {
    return `${presentation.averageLabel} (${presentation.reviewCount})`
  }
  return presentation.emptyLabel
}

export function ProfiGuideRatingBadge(props: {
  summary: GuideRatingSummary
  className?: string
}) {
  const label = ratingChipLabel(props.summary)

  return (
    <span className={`${chipClassName} ${props.className ?? ''}`}>
      <StarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{label}</span>
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
  const presentation = getGuideRatingPresentation(summary)
  const label = ratingChipLabel(summary)

  return (
    <Link
      to={`/korisnik/${encodeURIComponent(username)}/recenzije`}
      className={`${chipClassName} transition hover:border-emerald-200 hover:bg-emerald-50/40 active:scale-[0.99] ${className}`}
      aria-label={t('guideReviewsChipAria', {
        rating: presentation.averageLabel ?? presentation.emptyLabel,
        count: presentation.reviewCount,
      })}
    >
      <StarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <span className="text-sm font-extrabold tabular-nums text-gray-900 leading-none">{label}</span>
    </Link>
  )
}
