import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StarIcon } from '@heroicons/react/24/solid'
import {
  fetchGuidePublicReviews,
  type GuidePublicReview,
  type GuidePublicReviewsResponse,
} from '../../services/guideRatings'
import { UserNameWithProfiBadge } from '../../components/users/UserNameWithProfiBadge'
import { ProfiGuideRatingBadge } from '../../components/guides/ProfiGuideRatingChip'
import { formatDateShort } from '../../utils/dateUtils'

function StarsRow(props: { score?: number | null }) {
  const score = props.score ?? 0
  if (!score) return null
  return (
    <div className="flex items-center gap-0.5" aria-label={`${score}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          className={`h-4 w-4 ${n <= score ? 'text-amber-400' : 'text-gray-200'}`}
          aria-hidden
        />
      ))}
    </div>
  )
}

function ReviewCard(props: { review: GuidePublicReview }) {
  const { review } = props
  const raterName = review.rater?.fullName?.trim() || review.rater?.username || 'Korisnik'
  const avatar = review.rater?.avatar_url?.trim()

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02]">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-gray-100">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-emerald-600">
              {raterName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {review.rater?.username ? (
              <Link
                to={`/korisnik/${review.rater.username}`}
                className="text-sm font-bold text-gray-900 hover:text-emerald-700"
              >
                {raterName}
              </Link>
            ) : (
              <p className="text-sm font-bold text-gray-900">{raterName}</p>
            )}
            <StarsRow score={review.ocena} />
          </div>
          {review.akcija && (
            <p className="mt-1 text-xs text-gray-500">
              {review.akcija.naziv}
              {review.akcija.datum ? ` · ${formatDateShort(review.akcija.datum)}` : ''}
            </p>
          )}
          {review.komentar?.trim() ? (
            <p className="mt-2 text-sm leading-relaxed text-gray-700 whitespace-pre-line">{review.komentar.trim()}</p>
          ) : (
            <p className="mt-2 text-xs italic text-gray-400">Bez komentara.</p>
          )}
        </div>
      </div>
    </article>
  )
}

export default function GuideReviewsPage() {
  const { t } = useTranslation('userProfile')
  const { id, username } = useParams<{ id?: string; username?: string }>()
  const userKey = username || id || ''

  const [data, setData] = useState<GuidePublicReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userKey) return
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchGuidePublicReviews(userKey)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setError(t('guideReviewsLoadError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userKey, t])

  const guideName = data?.guide.fullName?.trim() || data?.guide.username || ''
  const summary = data?.summary ?? { prosecnaOcena: 0, brojOcena: 0, brojKomentara: 0 }

  return (
    <div className="pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {loading && <p className="text-sm text-gray-500">…</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {data && (
          <>
            <header className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm mb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <UserNameWithProfiBadge
                    name={guideName}
                    isProfiGuide
                    badgeSize={22}
                    nameClassName="text-xl font-extrabold text-gray-900"
                  />
                  <p className="mt-1 text-sm text-gray-500">{t('guideReviewsTitle')}</p>
                </div>
                <ProfiGuideRatingBadge summary={summary} className="shrink-0" />
              </div>
            </header>

            {data.recenzije.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">{t('guideReviewsEmpty')}</p>
            ) : (
              <ul className="space-y-3">
                {data.recenzije.map((review) => (
                  <li key={review.id}>
                    <ReviewCard review={review} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
