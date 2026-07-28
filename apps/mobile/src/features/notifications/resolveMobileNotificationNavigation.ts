import {
  getNotificationActionId,
  isActionCancelledNotificationType,
  resolveNotificationNavigationTarget,
  type NotificationNavigationTarget,
} from '@beleg/shared'

export type MobileNotificationNavTarget =
  | { screen: 'ActionDetail'; actionId: number; claimReward?: boolean }
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

export function resolveSemanticNotificationTarget(input: {
  type?: string | null
  link?: string | null
  metadata?: string | null | Record<string, unknown>
  obavestenjeId?: number | null
  pushData?: Record<string, unknown> | null
}): NotificationNavigationTarget {
  const push = parsePushNotificationData(input.pushData)
  return resolveNotificationNavigationTarget({
    type: input.type ?? push.type,
    link: input.link,
    metadata: input.metadata ?? input.pushData ?? undefined,
    notificationId: input.obavestenjeId ?? push.obavestenjeId,
  })
}

/** P0-compatible screen target for push pending + dedupe keys. */
export function semanticToMobileNavTarget(
  semantic: NotificationNavigationTarget,
  obavestenjeId?: number | null,
): MobileNotificationNavTarget {
  if (semantic.kind === 'action') {
    return {
      screen: 'ActionDetail',
      actionId: semantic.actionId,
      ...(semantic.claimReward ? { claimReward: true as const } : {}),
    }
  }
  const detailId =
    semantic.kind === 'notification-detail'
      ? semantic.notificationId
      : obavestenjeId ?? null
  if (detailId != null) {
    return { screen: 'NotificationDetail', obavestenjeId: detailId }
  }
  return { screen: 'none' }
}

/**
 * Central resolver for push tap / cold-start / in-app list (P0-compatible shape).
 */
export function resolveMobileNotificationNavigation(input: {
  type?: string | null
  link?: string | null
  metadata?: string | null | Record<string, unknown>
  obavestenjeId?: number | null
  pushData?: Record<string, unknown> | null
}): MobileNotificationNavTarget {
  const push = parsePushNotificationData(input.pushData)
  const obavestenjeId = input.obavestenjeId ?? push.obavestenjeId

  if (isActionCancelledNotificationType(input.type ?? push.type) || (push.isCancelled && push.actionId != null)) {
    const semantic = resolveSemanticNotificationTarget(input)
    const mapped = semanticToMobileNavTarget(semantic, obavestenjeId)
    if (mapped.screen !== 'none') return mapped
    if (push.actionId != null) {
      return { screen: 'ActionDetail', actionId: push.actionId }
    }
  }

  const semantic = resolveSemanticNotificationTarget(input)
  return semanticToMobileNavTarget(semantic, obavestenjeId)
}

export function shouldInvalidateActionQueriesForPush(data: Record<string, unknown> | undefined | null): number | null {
  const parsed = parsePushNotificationData(data)
  if (!isActionCancelledNotificationType(parsed.type) && !parsed.isCancelled) return null
  return parsed.actionId
}

/** Stable key used to skip duplicate cold-start + response listener navigations. */
export function buildMobileNotificationNavigationKey(
  target: MobileNotificationNavTarget,
  data?: Record<string, unknown> | null,
): string | null {
  if (target.screen === 'ActionDetail') {
    return `action:${target.actionId}:${data?.obavestenjeId ?? ''}`
  }
  if (target.screen === 'NotificationDetail') {
    return `notif:${target.obavestenjeId}`
  }
  return null
}

export function buildSemanticNavigationDedupeKey(
  semantic: NotificationNavigationTarget,
  obavestenjeId?: number | null,
): string | null {
  const mapped = semanticToMobileNavTarget(semantic, obavestenjeId)
  return buildMobileNotificationNavigationKey(mapped, {
    obavestenjeId: obavestenjeId ?? undefined,
  })
}

export function shouldSkipDuplicateNotificationNavigation(
  previousKey: string | null,
  nextKey: string | null,
): boolean {
  return nextKey != null && nextKey === previousKey
}
