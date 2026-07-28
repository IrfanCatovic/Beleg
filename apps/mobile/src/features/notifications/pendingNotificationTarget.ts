import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildMobileNotificationNavigationKey,
  resolveMobileNotificationNavigation,
} from './resolveMobileNotificationNavigation'
import { normalizeSavedAt } from '../../navigation/pendingNavigationSelection'
import { normalizeClaimRewardFlag } from '../actions/utils/summitShareData'

export const PENDING_NOTIFICATION_TARGET_KEY = 'pending_notification_target'

type PendingNotificationTargetBase =
  | {
      kind: 'notification-detail'
      notificationId: number
      dedupeKey: string
    }
  | {
      kind: 'action-detail'
      actionId: number
      inviteToken?: string
      claimReward?: boolean
      dedupeKey: string
    }

export type PendingNotificationTarget = PendingNotificationTargetBase & {
  savedAt?: number
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Build a serializable pending target from push data (or null if unsupported). */
export function buildPendingNotificationTarget(
  pushData: Record<string, unknown> | undefined | null,
): PendingNotificationTarget | null {
  const resolved = resolveMobileNotificationNavigation({ pushData: pushData ?? undefined })
  const dedupeKey = buildMobileNotificationNavigationKey(resolved, pushData ?? undefined)
  if (!dedupeKey) return null

  if (resolved.screen === 'ActionDetail') {
    if (!isPositiveInt(resolved.actionId)) return null
    return {
      kind: 'action-detail',
      actionId: resolved.actionId,
      dedupeKey,
      ...(resolved.claimReward ? { claimReward: true as const } : {}),
    }
  }

  if (resolved.screen === 'NotificationDetail') {
    if (!isPositiveInt(resolved.obavestenjeId)) return null
    return {
      kind: 'notification-detail',
      notificationId: resolved.obavestenjeId,
      dedupeKey,
    }
  }

  return null
}

export function isValidPendingNotificationTarget(
  value: unknown,
): value is PendingNotificationTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  if (typeof v.dedupeKey !== 'string' || !v.dedupeKey.trim()) return false

  if (v.kind === 'notification-detail') {
    return isPositiveInt(v.notificationId)
  }
  if (v.kind === 'action-detail') {
    if (!isPositiveInt(v.actionId)) return false
    if (v.inviteToken != null && typeof v.inviteToken !== 'string') return false
    // claimReward may be absent, true, or malformed (ignored on read) — do not reject whole target
    if (v.claimReward != null && typeof v.claimReward !== 'boolean') {
      // still valid target; normalizeClaimRewardFlag will strip on read
    }
    return true
  }
  return false
}

export async function savePendingNotificationTarget(
  target: PendingNotificationTarget,
): Promise<boolean> {
  if (!isValidPendingNotificationTarget(target)) return false
  const claimReward =
    target.kind === 'action-detail' ? normalizeClaimRewardFlag(target.claimReward) : undefined
  const toStore: PendingNotificationTarget =
    target.kind === 'action-detail'
      ? {
          kind: 'action-detail',
          actionId: target.actionId,
          dedupeKey: target.dedupeKey,
          ...(target.inviteToken ? { inviteToken: target.inviteToken } : {}),
          ...(claimReward ? { claimReward: true } : {}),
          savedAt: Date.now(),
        }
      : {
          ...target,
          savedAt: Date.now(),
        }
  try {
    await AsyncStorage.setItem(PENDING_NOTIFICATION_TARGET_KEY, JSON.stringify(toStore))
    return true
  } catch {
    return false
  }
}

export async function readPendingNotificationTarget(): Promise<PendingNotificationTarget | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_NOTIFICATION_TARGET_KEY)
    if (!raw) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      await AsyncStorage.removeItem(PENDING_NOTIFICATION_TARGET_KEY)
      return null
    }
    if (!isValidPendingNotificationTarget(parsed)) {
      await AsyncStorage.removeItem(PENDING_NOTIFICATION_TARGET_KEY)
      return null
    }
    if (parsed.kind === 'action-detail') {
      const claimReward = normalizeClaimRewardFlag(parsed.claimReward)
      return {
        kind: 'action-detail',
        actionId: parsed.actionId,
        dedupeKey: parsed.dedupeKey,
        ...(parsed.inviteToken ? { inviteToken: parsed.inviteToken } : {}),
        ...(claimReward ? { claimReward: true } : {}),
        savedAt: normalizeSavedAt(parsed.savedAt),
      }
    }
    return {
      ...parsed,
      savedAt: normalizeSavedAt(parsed.savedAt),
    }
  } catch {
    return null
  }
}

export async function clearPendingNotificationTarget(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_NOTIFICATION_TARGET_KEY)
  } catch {
    // ignore
  }
}

/**
 * Read and clear only if still present (atomic enough for our single-writer use).
 * Caller navigates; use clear after successful navigation instead if preferred.
 */
export async function consumePendingNotificationTarget(): Promise<PendingNotificationTarget | null> {
  const target = await readPendingNotificationTarget()
  if (!target) return null
  await clearPendingNotificationTarget()
  return target
}
