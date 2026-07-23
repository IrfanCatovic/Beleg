/**
 * Shared notification type helpers + navigation targets.
 * Additive: unknown types remain safe strings for older clients.
 */

export const NOTIFICATION_TYPE_ACTION_CANCELLED = 'action_cancelled' as const

export type KnownNotificationType =
  | 'uplata'
  | 'akcija'
  | 'zadatak'
  | 'post'
  | 'broadcast'
  | 'subskripcija'
  | 'follow'
  | 'action_participation_request'
  | 'summit_reward'
  | 'guide_booking_request'
  | 'action_signup_request'
  | typeof NOTIFICATION_TYPE_ACTION_CANCELLED
  | string

export interface ObavestenjeNavigationInput {
  type?: string | null
  link?: string | null
  metadata?: string | null | Record<string, unknown>
}

export type ObavestenjeNavigationTarget =
  | { kind: 'action'; actionId: number; path: string }
  | { kind: 'link'; path: string }
  | { kind: 'detail'; path: null }
  | { kind: 'none' }

function parseMetadata(raw: ObavestenjeNavigationInput['metadata']): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* ignore */
  }
  return {}
}

function positiveId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const n = Number.parseInt(value, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return null
}

/** Canonical action id from metadata (akcijaId preferred; actionId fallback). */
export function getNotificationActionId(meta: Record<string, unknown>): number | null {
  return positiveId(meta.akcijaId) ?? positiveId(meta.actionId)
}

/**
 * Resolves where a notification click should navigate.
 * `action_cancelled` → action detail when action id is known; otherwise safe detail fallback.
 */
export function resolveObavestenjeNavigationTarget(
  input: ObavestenjeNavigationInput,
): ObavestenjeNavigationTarget {
  const type = (input.type ?? '').trim()
  const link = (input.link ?? '').trim()
  const meta = parseMetadata(input.metadata)
  const actionId = getNotificationActionId(meta)

  if (type === NOTIFICATION_TYPE_ACTION_CANCELLED) {
    if (actionId != null) {
      return { kind: 'action', actionId, path: `/akcije/${actionId}` }
    }
    if (link.startsWith('/akcije/')) {
      const fromLink = positiveId(link.split('/')[2]?.split('?')[0])
      if (fromLink != null) {
        return { kind: 'action', actionId: fromLink, path: `/akcije/${fromLink}` }
      }
    }
    return { kind: 'detail', path: null }
  }

  if ((type === 'akcija' || type === 'summit_reward') && link) {
    return { kind: 'link', path: link }
  }

  if (link) {
    return { kind: 'link', path: link }
  }

  return { kind: 'detail', path: null }
}

export function isActionCancelledNotificationType(type: string | null | undefined): boolean {
  return (type ?? '').trim() === NOTIFICATION_TYPE_ACTION_CANCELLED
}
