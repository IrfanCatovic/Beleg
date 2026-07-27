import {
  shouldSkipDuplicateNotificationNavigation,
} from './resolveMobileNotificationNavigation'
import type { PendingNotificationTarget } from './pendingNotificationTarget'
import type { PushNotificationResponseDecision } from './decidePushNotificationResponse'

export type ApplyPushDecisionResult =
  | 'noop'
  | 'saved-pending'
  | 'navigated'
  | 'deferred-pending'
  | 'persist-failed'

/**
 * Only clear Expo's last notification response after the cold-start decision was
 * safely applied. A failed pending persist must leave the native response intact.
 */
export function shouldClearNativeLastNotificationResponse(
  result: ApplyPushDecisionResult | null,
): boolean {
  if (result == null) return true
  return result !== 'persist-failed'
}

/**
 * Apply a pure push decision: save pending, navigate+dedupe, or defer when nav not ready.
 * Does not mark success dedupe on save-pending / deferred / failure.
 */
export async function applyPushNotificationDecision(opts: {
  decision: PushNotificationResponseDecision
  tryNavigate: (target: PendingNotificationTarget) => boolean
  savePending: (target: PendingNotificationTarget) => Promise<boolean>
  clearPending: () => Promise<void>
  onNavigated: (dedupeKey: string) => void
}): Promise<ApplyPushDecisionResult> {
  const { decision } = opts
  if (decision.action === 'none' || decision.action === 'skip-duplicate') {
    return 'noop'
  }

  if (decision.action === 'save-pending') {
    const saved = await opts.savePending(decision.target)
    return saved ? 'saved-pending' : 'persist-failed'
  }

  const target = decision.target
  let navigated = false
  try {
    navigated = opts.tryNavigate(target)
  } catch {
    navigated = false
  }

  if (navigated) {
    opts.onNavigated(target.dedupeKey)
    await opts.clearPending()
    return 'navigated'
  }

  const saved = await opts.savePending(target)
  return saved ? 'deferred-pending' : 'persist-failed'
}

export type ConsumePendingResult =
  | 'empty'
  | 'skipped-duplicate'
  | 'navigated'
  | 'not-ready'
  | 'navigate-failed'

/**
 * After login: read pending target, navigate once when ready, then clear + success-dedupe.
 * Leaves pending intact when navigator is not ready or navigation throws.
 */
export async function consumePendingNotificationAfterAuth(opts: {
  readPending: () => Promise<PendingNotificationTarget | null>
  clearPending: () => Promise<void>
  tryNavigate: (target: PendingNotificationTarget) => boolean
  lastSuccessfulDedupeKey: string | null
  onNavigated: (dedupeKey: string) => void
  onBeforeNavigate?: (target: PendingNotificationTarget) => void
}): Promise<ConsumePendingResult> {
  const pending = await opts.readPending()
  if (!pending) return 'empty'

  if (
    shouldSkipDuplicateNotificationNavigation(opts.lastSuccessfulDedupeKey, pending.dedupeKey)
  ) {
    await opts.clearPending()
    return 'skipped-duplicate'
  }

  opts.onBeforeNavigate?.(pending)

  let navigated = false
  try {
    navigated = opts.tryNavigate(pending)
  } catch {
    return 'navigate-failed'
  }

  if (!navigated) return 'not-ready'

  opts.onNavigated(pending.dedupeKey)
  await opts.clearPending()
  return 'navigated'
}
