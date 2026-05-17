import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StarIcon } from '@heroicons/react/24/solid'
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'

export function GuideRatingModal(props: {
  open: boolean
  guideName: string
  saving?: boolean
  onClose: () => void
  onSkip: () => void
  onSubmit: (payload: { ocena?: number; komentar?: string }) => void | Promise<void>
}) {
  const { t } = useTranslation('actionDetails')
  const [stars, setStars] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [komentar, setKomentar] = useState('')

  const displayStars = hover ?? stars
  const komentarTrim = komentar.trim()
  const commentWithoutRating = komentarTrim.length > 0 && stars == null
  const canSubmit = stars != null && !commentWithoutRating

  const starButtons = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((n) => {
        const filled = displayStars != null && n <= displayStars
        const Icon = filled ? StarIcon : StarOutlineIcon
        return (
          <button
            key={n}
            type="button"
            disabled={props.saving}
            className="p-0.5 rounded-md transition hover:scale-105 disabled:opacity-50"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setStars(n)}
            aria-label={t('guideRatingStar', { n })}
          >
            <Icon className={`h-9 w-9 ${filled ? 'text-amber-400' : 'text-gray-300'}`} />
          </button>
        )
      }),
    [displayStars, props.saving, t],
  )

  if (!props.open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onClick={props.onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-rating-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50/90 to-emerald-50/50">
          <h2 id="guide-rating-title" className="text-sm font-bold text-gray-900">
            {t('guideRatingTitle')}
          </h2>
          <p className="mt-1 text-xs text-gray-600">{t('guideRatingSubtitle', { name: props.guideName })}</p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('guideRatingStarsLabel')}</p>
            <div className="flex justify-center gap-1">{starButtons}</div>
            <p className="mt-2 text-[11px] text-gray-500 text-center">{t('guideRatingOptionalHint')}</p>
          </div>

          <div>
            <label htmlFor="guide-rating-comment" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('guideRatingCommentLabel')}
            </label>
            <textarea
              id="guide-rating-comment"
              rows={3}
              value={komentar}
              disabled={props.saving}
              onChange={(e) => setKomentar(e.target.value)}
              placeholder={t('guideRatingCommentPlaceholder')}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
            />
            {commentWithoutRating && (
              <p className="mt-1.5 text-xs text-rose-600">{t('guideRatingCommentNeedsScore')}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={!canSubmit || props.saving}
              onClick={() => {
                const payload: { ocena?: number; komentar?: string } = {}
                if (stars != null) payload.ocena = stars
                if (komentarTrim) payload.komentar = komentarTrim
                void props.onSubmit(payload)
              }}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {props.saving ? t('guideRatingSaving') : t('guideRatingSubmit')}
            </button>
            <button
              type="button"
              disabled={props.saving}
              onClick={props.onSkip}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              {t('guideRatingSkip')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
