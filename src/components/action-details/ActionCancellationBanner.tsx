import {
  formatActionCancelledAt,
  getCancellationReasonDisplay,
  isActionCancelled,
  type AkcijaDetail,
} from '@beleg/shared'
import type { TFunction } from 'i18next'

type CancellationAction = Pick<
  AkcijaDetail,
  'isCancelled' | 'cancelledAt' | 'cancellationReason'
>

export function ActionCancellationBanner({
  akcija,
  t,
}: {
  akcija: CancellationAction
  t: TFunction
}) {
  if (!isActionCancelled(akcija)) return null

  const reason = getCancellationReasonDisplay(akcija.cancellationReason)
  const cancelledAtLabel = formatActionCancelledAt(akcija.cancelledAt)

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 sm:mx-6 lg:mx-8 mt-4 mb-2 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-4 sm:px-5"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-rose-800">
        {t('actionCancelledTitle', { defaultValue: 'Akcija je otkazana' })}
      </p>
      <div className="mt-2 space-y-1.5 text-sm text-rose-900/90">
        <p>
          <span className="font-semibold">
            {t('cancellationReasonLabel', { defaultValue: 'Razlog:' })}
          </span>{' '}
          <span className="whitespace-pre-wrap">{reason}</span>
        </p>
        {cancelledAtLabel ? (
          <p>
            <span className="font-semibold">
              {t('cancelledAtLabel', { defaultValue: 'Otkazano:' })}
            </span>{' '}
            {cancelledAtLabel}
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-rose-700/80">
        {t('cancelledPaymentsNote', {
          defaultValue: 'Evidentirane uplate nisu automatski refundirane.',
        })}
      </p>
    </div>
  )
}
