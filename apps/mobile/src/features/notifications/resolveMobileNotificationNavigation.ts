import {
  getNotificationActionId,
  isActionCancelledNotificationType,
  resolveObavestenjeNavigationTarget,
} from '@beleg/shared'

export type MobileNotificationNavTarget =
  | { screen: 'ActionDetail'; actionId: number }
  | { screen: 'NotificationDetail'; obavestenjeId: number }
  | { screen: 'none' }

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const n = Number.parseInt(value, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return null
}

/** Android FCM/Expo data values are strings; iOS may send numbers. */
export function parsePushNotificationData(
  data: Record<string, unknown> | undefined | null,
): {
  obavestenjeId: number | null
  type: string
  actionId: number | null
  isCancelled: boolean
} {
  const raw = data ?? {}
  const type = typeof raw.type === 'string' ? raw.type : ''
  const actionId =
    getNotificationActionId(raw) ??
    parsePositiveInt(raw.akcijaId) ??
    parsePositiveInt(raw.actionId)
  const isCancelled =
    raw.isCancelled === true ||
    raw.isCancelled === 'true' ||
    raw.isCancelled === '1'
  return {
    obavestenjeId: parsePositiveInt(raw.obavestenjeId),
    type,
    actionId,
    isCancelled,
  }
}

/**
 * Central resolver for push tap / cold-start / in-app list.
 * Prefer ActionDetail for action_cancelled; otherwise NotificationDetail when id known.
 */
export function resolveMobileNotificationNavigation(input: {
  type?: string | null
  link?: string | null
  metadata?: string | null | Record<string, unknown>
  obavestenjeId?: number | null
  pushData?: Record<string, unknown> | null
}): MobileNotificationNavTarget {
  const push = parsePushNotificationData(input.pushData)
  const type = (input.type ?? push.type ?? '').trim()
  const obavestenjeId = input.obavestenjeId ?? push.obavestenjeId

  if (isActionCancelledNotificationType(type) || (push.isCancelled && push.actionId != null)) {
    const shared = resolveObavestenjeNavigationTarget({
      type: type || 'action_cancelled',
      link: input.link,
      metadata: input.metadata ?? input.pushData ?? undefined,
    })
    if (shared.kind === 'action') {
      return { screen: 'ActionDetail', actionId: shared.actionId }
    }
    if (push.actionId != null) {
      return { screen: 'ActionDetail', actionId: push.actionId }
    }
  }

  if (obavestenjeId != null) {
    return { screen: 'NotificationDetail', obavestenjeId }
  }
  return { screen: 'none' }
}

export function shouldInvalidateActionQueriesForPush(data: Record<string, unknown> | undefined | null): number | null {
  const parsed = parsePushNotificationData(data)
  if (!isActionCancelledNotificationType(parsed.type) && !parsed.isCancelled) return null
  return parsed.actionId
}
