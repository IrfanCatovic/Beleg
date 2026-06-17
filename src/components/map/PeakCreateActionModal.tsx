import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { XMarkIcon, CalendarDaysIcon, PlusIcon, UserGroupIcon, ClockIcon } from '@heroicons/react/24/outline'

export type PeakActionPeak = {
  id: number
  naziv: string
  planina?: string
}

type Props = {
  open: boolean
  onClose: () => void
  peak: PeakActionPeak | null
  canClub: boolean
  canGuide: boolean
}

type Step = 'kind' | 'clubWhen'

export function PeakCreateActionModal({ open, onClose, peak, canClub, canGuide }: Props) {
  const { t } = useTranslation('ferrate')
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('kind')

  useEffect(() => {
    if (!open) return
    setStep(canClub && !canGuide ? 'clubWhen' : 'kind')
  }, [open, canClub, canGuide])

  if (!open || !peak) return null

  const goNewClub = () => navigate(`/dodaj-akciju?tip=planina&peak_id=${peak.id}&organizator=klub`)
  const goPastClub = () => navigate(`/profil/dodaj-proslu-akciju?tip=planina&peak_id=${peak.id}`)
  const goGuide = () => navigate(`/dodaj-akciju?tip=planina&peak_id=${peak.id}&organizator=vodic`)

  const optionBtn =
    'flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99]'

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 px-3 pt-[calc(3.5rem+0.75rem)] pb-[calc(5rem+0.75rem)] backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="peak-create-action-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xl ring-1 ring-black/[0.04]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="peak-create-action-title" className="text-base font-bold text-gray-900">
              {t('peakCreateModal.title')}
            </h2>
            <p className="mt-0.5 truncate text-sm text-gray-500">
              {peak.naziv}
              {peak.planina?.trim() ? ` · ${peak.planina}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            aria-label={t('peakCreateModal.close')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2.5 px-4 py-4 sm:px-5">
          {step === 'kind' && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t('peakCreateModal.chooseKind')}
              </p>
              {canClub && (
                <button
                  type="button"
                  onClick={() => setStep('clubWhen')}
                  className={`${optionBtn} border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <UserGroupIcon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-gray-900">{t('peakCreateModal.club')}</span>
                    <span className="block text-xs text-gray-500">{t('peakCreateModal.clubDesc')}</span>
                  </span>
                </button>
              )}
              {canGuide && (
                <button
                  type="button"
                  onClick={goGuide}
                  className={`${optionBtn} border-sky-200 bg-sky-50/50 hover:bg-sky-50`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                    <PlusIcon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-gray-900">{t('peakCreateModal.guide')}</span>
                    <span className="block text-xs text-gray-500">{t('peakCreateModal.guideDesc')}</span>
                  </span>
                </button>
              )}
            </>
          )}

          {step === 'clubWhen' && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t('peakCreateModal.chooseWhen')}
              </p>
              <button
                type="button"
                onClick={goNewClub}
                className={`${optionBtn} border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <CalendarDaysIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-gray-900">{t('peakCreateModal.newAction')}</span>
                  <span className="block text-xs text-gray-500">{t('peakCreateModal.newActionDesc')}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={goPastClub}
                className={`${optionBtn} border-gray-200 bg-gray-50/60 hover:bg-gray-50`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-600 text-white">
                  <ClockIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-gray-900">{t('peakCreateModal.pastAction')}</span>
                  <span className="block text-xs text-gray-500">{t('peakCreateModal.pastActionDesc')}</span>
                </span>
              </button>
              {canClub && canGuide && (
                <button
                  type="button"
                  onClick={() => setStep('kind')}
                  className="mt-1 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 transition hover:text-emerald-700"
                >
                  {t('peakCreateModal.back')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
