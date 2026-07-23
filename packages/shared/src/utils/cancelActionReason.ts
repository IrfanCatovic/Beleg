export const CANCEL_ACTION_REASON_ERROR =
  'Razlog otkazivanja mora imati između 3 i 500 karaktera.'

export interface NormalizeCancelActionReasonResult {
  value: string
  runeCount: number
  isValid: boolean
  error: string | null
}

/** Trim + Unicode (rune) dužina 3–500. Backend ostaje konačni autoritet. */
export function normalizeCancelActionReason(reason: string): NormalizeCancelActionReasonResult {
  const value = typeof reason === 'string' ? reason.trim() : ''
  const runeCount = Array.from(value).length
  const isValid = runeCount >= 3 && runeCount <= 500
  return {
    value,
    runeCount,
    isValid,
    error: isValid ? null : CANCEL_ACTION_REASON_ERROR,
  }
}
