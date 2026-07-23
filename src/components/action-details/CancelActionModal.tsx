import { useEffect, useMemo, useRef, useState } from 'react'
import {
  canConfirmCancelAction,
  formatCancelModalCount,
  isCancelRefundAckRequired,
  normalizeCancelActionReason,
  type CancelModalCount,
} from '@beleg/shared'

export interface CancelActionModalProps {
  open: boolean
  confirmedCount: CancelModalCount
  pendingCount: CancelModalCount
  paidCount: CancelModalCount
  isCompleted?: boolean
  isCancelled?: boolean
  submitting: boolean
  error: string
  onClose: () => void
  onConfirm: (trimmedReason: string) => Promise<void>
}

export default function CancelActionModal({
  open,
  confirmedCount,
  pendingCount,
  paidCount,
  isCompleted,
  isCancelled,
  submitting,
  error,
  onClose,
  onConfirm,
}: CancelActionModalProps) {
  const [reason, setReason] = useState('')
  const [refundAck, setRefundAck] = useState(false)
  const [localError, setLocalError] = useState('')
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setReason('')
    setRefundAck(false)
    setLocalError('')
    inFlightRef.current = false
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting])

  const normalized = useMemo(() => normalizeCancelActionReason(reason), [reason])
  const refundRequired = isCancelRefundAckRequired(paidCount)
  const canConfirm = canConfirmCancelAction({
    submitting,
    reason,
    refundAckChecked: refundAck,
    paidCount,
    isCompleted,
    isCancelled,
  })

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlightRef.current || submitting) return
    if (
      !canConfirmCancelAction({
        submitting: false,
        reason,
        refundAckChecked: refundAck,
        paidCount,
        isCompleted,
        isCancelled,
      })
    ) {
      if (!normalized.isValid) setLocalError(normalized.error || '')
      return
    }
    inFlightRef.current = true
    setLocalError('')
    try {
      await onConfirm(normalized.value)
    } finally {
      inFlightRef.current = false
    }
  }

  const displayError = localError || error
  const reasonError =
    reason.trim().length > 0 && !normalized.isValid ? normalized.error : localError && !normalized.isValid ? localError : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-action-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-rose-50/90 to-orange-50/50">
          <h2 id="cancel-action-title" className="text-sm font-bold text-gray-900 tracking-tight">
            Otkaži akciju
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800 transition disabled:opacity-50"
            aria-label="Zatvori"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Ova akcija će biti označena kao otkazana. Nove prijave, izmjene i završavanje akcije više neće biti
            dozvoljeni.
          </p>

          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Potvrđeni učesnici</span>
              <span className="font-semibold tabular-nums text-gray-900">
                {formatCancelModalCount(confirmedCount)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Zahtjevi na čekanju</span>
              <span className="font-semibold tabular-nums text-gray-900">
                {formatCancelModalCount(pendingCount)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Evidentirane uplate</span>
              <span className="font-semibold tabular-nums text-gray-900">
                {formatCancelModalCount(paidCount)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-2 text-sm text-amber-950">
            <p>
              Otkazivanje akcije ne vrši automatski refund i ne mijenja postojeću evidenciju uplata.
            </p>
            {paidCount != null && paidCount > 0 ? (
              <p className="font-medium">
                Postoji {paidCount} evidentiranih uplata. Potrebno ih je ručno provjeriti i dogovoriti eventualni
                povrat novca.
              </p>
            ) : null}
            {refundRequired ? (
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-amber-300 text-rose-600 focus:ring-rose-500"
                  checked={refundAck}
                  disabled={submitting}
                  onChange={(e) => setRefundAck(e.target.checked)}
                />
                <span>Razumijem da refund neće biti izvršen automatski.</span>
              </label>
            ) : null}
          </div>

          <div>
            <label htmlFor="cancel-action-reason" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Razlog otkazivanja
            </label>
            <textarea
              id="cancel-action-reason"
              rows={4}
              value={reason}
              disabled={submitting}
              placeholder="Npr. loši vremenski uslovi, bezbjednosni razlozi..."
              onChange={(e) => {
                setReason(e.target.value)
                if (localError) setLocalError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  // Do not submit on Enter in textarea
                  e.stopPropagation()
                }
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 disabled:opacity-60 resize-y min-h-[96px]"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-rose-600 min-h-[1rem]">
                {reasonError || (displayError && !reasonError ? displayError : '')}
              </p>
              <p className="text-[11px] text-gray-400 tabular-nums shrink-0">
                {normalized.runeCount} / 500
              </p>
            </div>
          </div>

          {(isCompleted || isCancelled) && (
            <p className="text-xs text-rose-700 font-medium">
              {isCancelled
                ? 'Akcija je već otkazana.'
                : 'Završena akcija ne može biti otkazana.'}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? 'Otkazivanje...' : 'Potvrdi otkazivanje'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
