import type { PrijavaStatus } from '../types/prijava'
import { isActionLifecycleActive } from './actionLifecycle'

/** Statusi koji blokiraju novi signup zahtjev (aktivna ili završena prijava). */
export const PRIJAVA_BLOCKING_STATUSES: readonly PrijavaStatus[] = [
  'prijavljen',
  'popeo se',
  'nije uspeo',
]

export function isBlockingPrijavaStatus(
  status: PrijavaStatus | string | null | undefined,
): boolean {
  return (
    status === 'prijavljen' || status === 'popeo se' || status === 'nije uspeo'
  )
}

export function isCancelledPrijavaStatus(
  status: PrijavaStatus | string | null | undefined,
): boolean {
  return status === 'otkazano'
}

/** Potvrđena prijava na spisku (status prijavljen). */
export function isConfirmedPrijavaStatus(
  status: PrijavaStatus | string | null | undefined,
): boolean {
  return status === 'prijavljen'
}

/**
 * Aktivni pending signup za UI: nikad na završenoj ili otkazanoj akciji
 * (zaštita od stale cache-a). Backend/refetch i dalje ostaje source of truth.
 */
export function isActivePendingSignup(input: {
  isCompleted?: boolean | null
  isCancelled?: boolean | null
  signupRequestStatus?: string | null
}): boolean {
  return (
    isActionLifecycleActive(input) && input.signupRequestStatus === 'pending'
  )
}

/** Cancel-pending na list kartici: ne dozvoli stale pending ID na terminalnoj akciji. */
export function canCancelPendingSignupOnListCard(input: {
  isCompleted?: boolean | null
  isCancelled?: boolean | null
  hasPendingSignupId?: boolean
}): boolean {
  return isActionLifecycleActive(input) && !!input.hasPendingSignupId
}

export interface ActionSignupEligibilityInput {
  prijavaStatus?: PrijavaStatus | string | null
  isPendingSignup?: boolean
  isCapacityFull?: boolean
  isCompleted?: boolean
  isCancelled?: boolean
  isSignupClosed?: boolean
}

/** Da li korisnik može poslati novi signup zahtjev (bez obzira na izbore). */
export function canRequestActionSignup(input: ActionSignupEligibilityInput): boolean {
  if (!isActionLifecycleActive(input) || input.isSignupClosed) return false
  if (input.isPendingSignup) return false
  if (isBlockingPrijavaStatus(input.prijavaStatus)) return false
  if (input.isCapacityFull) return false
  return true
}

export interface ActionSignupUiInput extends ActionSignupEligibilityInput {
  selectionsDirty?: boolean
  saving?: boolean
}

export interface ActionSignupUiState {
  isRegistered: boolean
  isCancelledPrijava: boolean
  isBlockingPrijava: boolean
  canRequestSignup: boolean
  isSignupPrimaryDisabled: boolean
  showRegisteredBadge: boolean
  showCancelledNotice: boolean
  showCapacityFullNotice: boolean
}

/** Jedinstveno UI stanje za signup dugme i status poruke (web + mobile). */
export function deriveActionSignupUiState(
  input: ActionSignupUiInput,
): ActionSignupUiState {
  const status = input.prijavaStatus
  const isRegistered = isConfirmedPrijavaStatus(status)
  const isCancelledPrijava = isCancelledPrijavaStatus(status)
  const isBlockingPrijava = isBlockingPrijavaStatus(status)
  const canRequestSignup = canRequestActionSignup(input)
  const saving = !!input.saving
  const isPendingSignup = !!input.isPendingSignup
  const selectionsDirty = !!input.selectionsDirty
  const lifecycleActive = isActionLifecycleActive(input)

  const isSignupPrimaryDisabled =
    !lifecycleActive ||
    saving ||
    isPendingSignup ||
    (isRegistered && !selectionsDirty) ||
    (isBlockingPrijava && !isCancelledPrijava) ||
    (!isRegistered && !canRequestSignup)

  const showCapacityFullNotice =
    lifecycleActive &&
    !!input.isCapacityFull &&
    !isPendingSignup &&
    !isRegistered &&
    !isBlockingPrijava

  return {
    isRegistered,
    isCancelledPrijava,
    isBlockingPrijava,
    canRequestSignup,
    isSignupPrimaryDisabled,
    showRegisteredBadge: isRegistered,
    // Istorijski otkazana prijava: ne nudi rejoin UX na terminalnoj akciji.
    showCancelledNotice: lifecycleActive && isCancelledPrijava && !isPendingSignup,
    showCapacityFullNotice,
  }
}

/** Da li korisnik može mijenjati logističke izbore prije slanja zahtjeva ili čuvanja. */
export function canEditActionSignupChoices(input: {
  isCompleted?: boolean
  isCancelled?: boolean
  isPendingSignup?: boolean
  prijavaStatus?: PrijavaStatus | string | null
}): boolean {
  if (!isActionLifecycleActive(input) || input.isPendingSignup) return false
  const status = input.prijavaStatus
  if (!status) return true
  return isConfirmedPrijavaStatus(status) || isCancelledPrijavaStatus(status)
}
