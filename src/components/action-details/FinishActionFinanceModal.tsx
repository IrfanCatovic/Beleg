import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(',', '.')
  if (s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

interface FinishActionFinanceModalProps {
  open: boolean
  currency: string
  prihodUkupan: number
  /** Privatna akcija vodiča — prikaz pregleda uplata, bez upisa u finansije kluba. */
  skipClubFinances?: boolean
  onClose: () => void
  onConfirm: (rashodNaAkciji: number) => Promise<void>
}

export default function FinishActionFinanceModal({
  open,
  currency,
  prihodUkupan,
  skipClubFinances = false,
  onClose,
  onConfirm,
}: FinishActionFinanceModalProps) {
  const { t } = useTranslation('actionDetails')
  const [rashodStr, setRashodStr] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setRashodStr('0')
    setError('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting])

  const rashod = useMemo(() => parseAmount(rashodStr), [rashodStr])
  const netPreview = useMemo(() => {
    if (!Number.isFinite(rashod)) return null
    return prihodUkupan - rashod
  }, [prihodUkupan, rashod])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number.isFinite(rashod) || rashod < 0) {
      setError(t('finishFinanceRashodInvalid'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onConfirm(rashod)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        t('finishError')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finish-finance-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/90 to-teal-50/50">
          <h2 id="finish-finance-title" className="text-sm font-bold text-gray-900 tracking-tight">
            {skipClubFinances ? t('finishGuideModalTitle') : t('finishFinanceModalTitle')}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800 transition disabled:opacity-50"
            aria-label={t('summitShareClose')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            {skipClubFinances ? t('finishGuideModalBody') : t('finishConfirmBody')}
          </p>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
            <p className="text-xs font-medium text-emerald-800/90">{t('finishFinanceTotalIncome')}</p>
            <p className="text-lg font-bold text-emerald-900 tabular-nums">
              {prihodUkupan.toFixed(2)} <span className="text-sm font-semibold">{currency}</span>
            </p>
          </div>

          {!skipClubFinances && (
            <>
              <div>
                <label htmlFor="finish-finance-rashod" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t('finishFinanceExpenseLabel')}
                </label>
                <input
                  id="finish-finance-rashod"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={rashodStr}
                  onChange={(e) => setRashodStr(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-300"
                  disabled={submitting}
                />
                <p className="mt-1 text-[11px] text-gray-500">{t('finishFinanceExpenseHelp')}</p>
              </div>

              {netPreview !== null && Number.isFinite(netPreview) && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5">
                  <p className="text-xs text-gray-600">{t('finishFinanceNetPreview')}</p>
                  <p className="text-sm font-bold text-gray-900 tabular-nums">
                    {netPreview.toFixed(2)} {currency}
                  </p>
                </div>
              )}
            </>
          )}

          {error ? <p className="text-xs text-rose-600 font-medium">{error}</p> : null}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-sm disabled:opacity-60"
            >
              {submitting ? t('finishFinanceSubmitting') : skipClubFinances ? t('finishAction') : t('finishFinanceConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
