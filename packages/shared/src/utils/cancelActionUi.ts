import { isBlockingPrijavaStatus } from './prijavaStatus'
import { isActionLifecycleActive } from './actionLifecycle'
import { normalizeCancelActionReason } from './cancelActionReason'
import { getApiErrorMessage } from './apiError'

export type CancelModalCount = number | null

export interface CancelActionButtonVisibilityInput {
  canManageAction: boolean
  isCompleted?: boolean | null
  isCancelled?: boolean | null
  /** Detail je autoritativno učitan (nije loading / limited bez manage). */
  actionLoaded: boolean
  isLimitedView?: boolean
}

export function canShowCancelActionButton(input: CancelActionButtonVisibilityInput): boolean {
  if (!input.actionLoaded || !input.canManageAction) return false
  if (input.isLimitedView) return false
  return isActionLifecycleActive({
    isCompleted: input.isCompleted,
    isCancelled: input.isCancelled,
  })
}

export function countConfirmedParticipants(
  prijave: Array<{ status?: string | null }> | null | undefined,
  prijaveKnown: boolean,
): CancelModalCount {
  if (!prijaveKnown || !prijave) return null
  return prijave.filter((p) => isBlockingPrijavaStatus(p.status)).length
}

export function countPendingSignupRequests(
  requests: Array<{ status?: string | null }> | null | undefined,
  requestsKnown: boolean,
): CancelModalCount {
  if (!requestsKnown || !requests) return null
  return requests.filter((r) => r.status === 'pending').length
}

export function countPaidPrijave(
  prijave: Array<{ platio?: boolean | null }> | null | undefined,
  prijaveKnown: boolean,
): CancelModalCount {
  if (!prijaveKnown || !prijave) return null
  return prijave.filter((p) => p.platio === true).length
}

export function formatCancelModalCount(count: CancelModalCount): string {
  return count == null ? '—' : String(count)
}

/** Checkbox potreban kada ima uplata ili je paid count nepoznat. */
export function isCancelRefundAckRequired(paidCount: CancelModalCount): boolean {
  return paidCount == null || paidCount > 0
}

export interface CanConfirmCancelActionInput {
  submitting: boolean
  reason: string
  refundAckChecked: boolean
  paidCount: CancelModalCount
  isCompleted?: boolean | null
  isCancelled?: boolean | null
}

export function canConfirmCancelAction(input: CanConfirmCancelActionInput): boolean {
  if (input.submitting) return false
  if (!isActionLifecycleActive(input)) return false
  const reason = normalizeCancelActionReason(input.reason)
  if (!reason.isValid) return false
  if (isCancelRefundAckRequired(input.paidCount) && !input.refundAckChecked) return false
  return true
}

export type CancelActionClientErrorKind =
  | 'bad_request'
  | 'forbidden'
  | 'not_found'
  | 'already_cancelled'
  | 'already_completed'
  | 'server'
  | 'unknown'

export interface CancelActionClientErrorMapping {
  kind: CancelActionClientErrorKind
  message: string
  shouldReload: boolean
  closeModalIfCancelled: boolean
}

export function mapCancelActionHttpError(
  err: unknown,
  fallbacks?: Partial<Record<CancelActionClientErrorKind, string>>,
): CancelActionClientErrorMapping {
  const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response
    ?.status
  const serverMsg = getApiErrorMessage(err, '')

  if (status === 400) {
    return {
      kind: 'bad_request',
      message: serverMsg || fallbacks?.bad_request || 'Nevažeći zahtjev.',
      shouldReload: false,
      closeModalIfCancelled: false,
    }
  }
  if (status === 403) {
    return {
      kind: 'forbidden',
      message: fallbacks?.forbidden || 'Nemate dozvolu da otkažete ovu akciju.',
      shouldReload: true,
      closeModalIfCancelled: false,
    }
  }
  if (status === 404) {
    return {
      kind: 'not_found',
      message: fallbacks?.not_found || 'Akcija više nije dostupna.',
      shouldReload: false,
      closeModalIfCancelled: false,
    }
  }
  if (status === 409) {
    // Backend: ErrAkcijaAlreadyCancelled / ErrAkcijaAlreadyComplete / ErrAkcijaCancelled
    if (/otkaz/i.test(serverMsg)) {
      return {
        kind: 'already_cancelled',
        message: fallbacks?.already_cancelled || 'Akcija je već otkazana.',
        shouldReload: true,
        closeModalIfCancelled: true,
      }
    }
    return {
      kind: 'already_completed',
      message: fallbacks?.already_completed || 'Završena akcija ne može biti otkazana.',
      shouldReload: true,
      closeModalIfCancelled: false,
    }
  }

  return {
    kind: status && status >= 500 ? 'server' : 'unknown',
    message: serverMsg || fallbacks?.server || 'Greška pri otkazivanju akcije.',
    shouldReload: false,
    closeModalIfCancelled: false,
  }
}
