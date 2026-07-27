import {
  shouldSkipDuplicateNotificationNavigation,
} from './resolveMobileNotificationNavigation'
import {
  buildPendingNotificationTarget,
  type PendingNotificationTarget,
} from './pendingNotificationTarget'

export type PushNotificationResponseDecision =
  | { action: 'none' }
  | { action: 'skip-duplicate' }
  | { action: 'save-pending'; target: PendingNotificationTarget }
  | { action: 'navigate'; target: PendingNotificationTarget }

/**
 * Pure decision for a push notification tap / cold-start response.
 * Does not touch storage or navigation — caller applies side effects.
 */
export function decidePushNotificationResponse(opts: {
  isLoggedIn: boolean
  pushData: Record<string, unknown> | undefined | null
  lastSuccessfulDedupeKey: string | null
}): PushNotificationResponseDecision {
  const target = buildPendingNotificationTarget(opts.pushData)
  if (!target) return { action: 'none' }

  // Success-dedupe only applies while authenticated. Logged-out taps must never
  // permanently discard a destination via a prior success key.
  if (
    opts.isLoggedIn &&
    shouldSkipDuplicateNotificationNavigation(opts.lastSuccessfulDedupeKey, target.dedupeKey)
  ) {
    return { action: 'skip-duplicate' }
  }

  if (!opts.isLoggedIn) {
    return { action: 'save-pending', target }
  }

  return { action: 'navigate', target }
}
