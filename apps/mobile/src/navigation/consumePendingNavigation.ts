import {
  shouldSkipDuplicateNotificationNavigation,
} from '../features/notifications/resolveMobileNotificationNavigation'
import type { PendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'
import { clearPendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'
import { clearPendingDeepLink } from './pendingDeepLink'
import {
  selectPendingNavigation,
  type PendingDeepLinkRecord,
  type PendingNavigationSelection,
} from './pendingNavigationSelection'

export type ConsumePendingNavigationResult =
  | 'not-ready'
  | 'empty'
  | 'navigated'
  | 'navigate-failed'
  | 'skipped-duplicate'
  | 'already-consumed'

export type ConsumePendingNavigationOpts = {
  isLoggedIn: boolean
  authLoading: boolean
  isNavigationReady: boolean
  sessionConsumed: boolean
  readUrlPending: () => Promise<PendingDeepLinkRecord | null>
  readPushPending: () => Promise<PendingNotificationTarget | null>
  clearUrlPending: () => Promise<void>
  clearPushPending: () => Promise<void>
  tryNavigateUrl: (url: string) => boolean
  tryNavigatePush: (target: PendingNotificationTarget) => boolean
  lastSuccessfulPushDedupeKey: string | null
  onPushNavigated: (dedupeKey: string) => void
  onBeforePushNavigate?: (target: PendingNotificationTarget) => void
  onSessionConsumed?: () => void
}

let consumeInFlight: Promise<ConsumePendingNavigationResult> | null = null

/** Reset single-flight guard (explicit logout / session invalidation). */
export function resetPendingNavigationConsumeState(): void {
  consumeInFlight = null
}

async function clearSelectionStorage(
  selection: PendingNavigationSelection,
  opts: Pick<ConsumePendingNavigationOpts, 'clearUrlPending' | 'clearPushPending'>,
): Promise<void> {
  const hadUrl =
    selection.selected.source === 'url' ||
    selection.superseded.some((c) => c.source === 'url')
  const hadPush =
    selection.selected.source === 'push' ||
    selection.superseded.some((c) => c.source === 'push')
  if (hadUrl) await opts.clearUrlPending()
  if (hadPush) await opts.clearPushPending()
}

async function runConsume(
  opts: ConsumePendingNavigationOpts,
): Promise<ConsumePendingNavigationResult> {
  if (opts.authLoading || !opts.isLoggedIn || !opts.isNavigationReady) {
    return 'not-ready'
  }
  if (opts.sessionConsumed) {
    return 'already-consumed'
  }

  let urlPending: PendingDeepLinkRecord | null = null
  let pushPending: PendingNotificationTarget | null = null
  try {
    urlPending = await opts.readUrlPending()
    pushPending = await opts.readPushPending()
  } catch {
    return 'navigate-failed'
  }

  const selection = selectPendingNavigation(urlPending, pushPending)
  if (!selection) return 'empty'

  const { selected } = selection

  if (selected.source === 'push') {
    if (
      shouldSkipDuplicateNotificationNavigation(
        opts.lastSuccessfulPushDedupeKey,
        selected.target.dedupeKey,
      )
    ) {
      await clearSelectionStorage(selection, opts)
      opts.onSessionConsumed?.()
      return 'skipped-duplicate'
    }
    opts.onBeforePushNavigate?.(selected.target)
    let navigated = false
    try {
      navigated = opts.tryNavigatePush(selected.target)
    } catch {
      return 'navigate-failed'
    }
    if (!navigated) return 'navigate-failed'
    opts.onPushNavigated(selected.target.dedupeKey)
    try {
      await clearSelectionStorage(selection, opts)
    } catch {
      opts.onSessionConsumed?.()
      return 'navigated'
    }
    opts.onSessionConsumed?.()
    return 'navigated'
  }

  let urlNavigated = false
  try {
    urlNavigated = opts.tryNavigateUrl(selected.target.url)
  } catch {
    return 'navigate-failed'
  }
  if (!urlNavigated) return 'navigate-failed'

  try {
    await clearSelectionStorage(selection, opts)
  } catch {
    opts.onSessionConsumed?.()
    return 'navigated'
  }
  opts.onSessionConsumed?.()
  return 'navigated'
}

/**
 * Coordinated consume: reads URL + push pending, selects latest, navigates once.
 * Single-flight: concurrent calls share the same in-flight promise.
 */
export function consumePendingNavigation(
  opts: ConsumePendingNavigationOpts,
): Promise<ConsumePendingNavigationResult> {
  if (consumeInFlight) return consumeInFlight

  consumeInFlight = runConsume(opts).finally(() => {
    consumeInFlight = null
  })
  return consumeInFlight
}

export async function clearPendingNavigationOnSessionEnd(): Promise<void> {
  resetPendingNavigationConsumeState()
  await Promise.all([clearPendingDeepLink(), clearPendingNotificationTarget()])
}
