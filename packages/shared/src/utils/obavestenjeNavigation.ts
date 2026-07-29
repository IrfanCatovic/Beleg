/**
 * Shared notification type helpers + canonical navigation targets.
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
  notificationId?: number | null
}

/** Canonical semantic navigation target (platform-agnostic). */
export type ProfileNotificationTarget = {
  kind: 'profile'
  userId?: number
  username?: string
}

export type ClubNotificationTarget = {
  kind: 'club'
  clubId?: number
  clubName?: string
}

export type NotificationNavigationTarget =
  | { kind: 'action'; actionId: number; claimReward?: boolean }
  | ProfileNotificationTarget
  | { kind: 'own-club' }
  | ClubNotificationTarget
  | { kind: 'guides' }
  | { kind: 'tasks' }
  | { kind: 'finances' }
  | { kind: 'home'; postId?: number }
  | { kind: 'notification-detail'; notificationId: number }
  | { kind: 'none' }

/** @deprecated Prefer NotificationNavigationTarget — kept for older call sites. */
export type ObavestenjeNavigationTarget =
  | { kind: 'action'; actionId: number; path: string }
  | { kind: 'link'; path: string }
  | { kind: 'detail'; path: null }
  | { kind: 'none' }

const ACTION_METADATA_TYPES = new Set([
  NOTIFICATION_TYPE_ACTION_CANCELLED,
  'summit_reward',
  'action_signup_request',
  'action_participation_request',
  'akcija',
])

const INTERNAL_HOSTS = new Set(['www.planiner.com', 'planiner.com', 'planiner.app'])

export function parseMetadata(raw: unknown): Record<string, unknown> {
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
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    // Reject decimals / non-digit strings; numeric strings like "42" remain valid.
    if (!/^\d+$/.test(trimmed)) return null
    const n = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return null
}

function trimString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function decodePathSegment(segment: string): string | null {
  try {
    return trimString(decodeURIComponent(segment))
  } catch {
    return null
  }
}

function normalizeLinkUrl(link: string): { pathname: string; searchParams: URLSearchParams } | null {
  const trimmed = link.trim()
  if (!trimmed) return null
  try {
    let url: URL
    if (trimmed.startsWith('/')) {
      url = new URL(trimmed, 'https://www.planiner.com')
    } else if (/^planiner:\/\//i.test(trimmed)) {
      url = new URL(trimmed.replace(/^planiner:\/\//i, 'https://planiner.app/'))
    } else if (/^https?:\/\//i.test(trimmed)) {
      url = new URL(trimmed)
      if (!INTERNAL_HOSTS.has(url.hostname.toLowerCase())) return null
    } else {
      return null
    }
    const pathname = url.pathname.replace(/\/$/, '') || '/'
    return { pathname, searchParams: url.searchParams }
  } catch {
    return null
  }
}

/** Parse a known internal notification link into a semantic target. */
export function parseCanonicalNotificationLink(link: string): NotificationNavigationTarget | null {
  const parsed = normalizeLinkUrl(link)
  if (!parsed) return null
  const { pathname, searchParams } = parsed

  const actionMatch = pathname.match(/^\/akcije\/(\d+)$/)
  if (actionMatch) {
    const actionId = positiveId(actionMatch[1])
    if (actionId == null) return null
    const claimReward = ['1', 'true'].includes((searchParams.get('claimReward') ?? '').trim().toLowerCase())
    return { kind: 'action', actionId, claimReward: claimReward || undefined }
  }

  const profileMatch = pathname.match(/^\/korisnik\/([^/]+)$/)
  if (profileMatch) {
    const username = decodePathSegment(profileMatch[1])
    if (!username) return null
    return { kind: 'profile', username }
  }

  const userIdRouteMatch = pathname.match(/^\/users\/(\d+)$/)
  if (userIdRouteMatch) {
    const userId = positiveId(userIdRouteMatch[1])
    if (userId == null) return null
    return { kind: 'profile', userId }
  }

  if (pathname === '/klub') return { kind: 'own-club' }

  const clubMatch = pathname.match(/^\/klubovi\/([^/]+)$/)
  if (clubMatch) {
    const clubName = decodePathSegment(clubMatch[1])
    if (!clubName) return null
    return { kind: 'club', clubName }
  }

  if (pathname === '/vodici') return { kind: 'guides' }
  if (pathname === '/zadaci') return { kind: 'tasks' }
  if (pathname === '/finansije') return { kind: 'finances' }
  if (pathname === '/home') {
    const postId = positiveId(searchParams.get('postId'))
    return postId != null ? { kind: 'home', postId } : { kind: 'home' }
  }

  const detailMatch = pathname.match(/^\/obavestenja\/(\d+)$/)
  if (detailMatch) {
    const notificationId = positiveId(detailMatch[1])
    if (notificationId == null) return null
    return { kind: 'notification-detail', notificationId }
  }

  return null
}

/** Canonical action id from metadata (akcijaId preferred; actionId fallback). */
export function getNotificationActionId(meta: Record<string, unknown>): number | null {
  return positiveId(meta.akcijaId) ?? positiveId(meta.actionId)
}

function resolveActionFromMetadata(
  type: string,
  meta: Record<string, unknown>,
): NotificationNavigationTarget | null {
  const actionId = getNotificationActionId(meta)
  if (actionId == null) return null

  const isCancelled =
    type === NOTIFICATION_TYPE_ACTION_CANCELLED ||
    meta.isCancelled === true ||
    meta.isCancelled === 'true' ||
    meta.isCancelled === '1'

  if (isCancelled) {
    return { kind: 'action', actionId }
  }

  if (type === 'summit_reward') {
    return { kind: 'action', actionId, claimReward: true }
  }

  if (ACTION_METADATA_TYPES.has(type)) {
    return { kind: 'action', actionId }
  }

  if (type === 'guide_booking_request') {
    return { kind: 'action', actionId }
  }

  return null
}

function resolveProfileFromMetadata(
  type: string,
  meta: Record<string, unknown>,
): NotificationNavigationTarget | null {
  const identity = resolveLegacyProfileIdentity(type, meta)
  if (!identity) return null
  const target: ProfileNotificationTarget = { kind: 'profile' }
  // Prefer stable ID alone so adapters never prefer a stale username over id.
  if (identity.userId != null) {
    target.userId = identity.userId
    return target
  }
  if (identity.username) {
    target.username = identity.username
    return target
  }
  return null
}

/**
 * Type-aware recovery of profile identity from notification metadata.
 * Pure: no API, no throw. Only proven legacy fields for profile destinations.
 *
 * Follow request (historical): requesterId / requesterUsername
 * Follow accepted (historical): targetId / targetUsername
 * Canonical (P1B+): targetUserId / targetUsername always win first.
 */
export function resolveLegacyProfileIdentity(
  notificationType: string | undefined,
  metadata: unknown,
): { userId?: number; username?: string } | null {
  const type = (notificationType ?? '').trim()
  const meta = parseMetadata(metadata)

  const canonicalId = positiveId(meta.targetUserId)
  const canonicalUsername = trimString(meta.targetUsername)

  if (canonicalId != null) {
    return { userId: canonicalId }
  }

  if (type === 'follow') {
    // Follow request shape: open the requester (not the recipient).
    const requesterId = positiveId(meta.requesterId)
    if (requesterId != null) {
      const username =
        trimString(meta.requesterUsername) ?? canonicalUsername ?? undefined
      return username ? { userId: requesterId, username } : { userId: requesterId }
    }
    // Follow accepted shape: open the accepter (follow targetId).
    const accepterId = positiveId(meta.targetId)
    if (accepterId != null) {
      const username =
        trimString(meta.targetUsername) ?? canonicalUsername ?? undefined
      return username ? { userId: accepterId, username } : { userId: accepterId }
    }
    const username =
      trimString(meta.requesterUsername) ??
      trimString(meta.targetUsername) ??
      canonicalUsername
    if (username) return { username }
    return null
  }

  // Non-follow types: only canonical targetUserId/targetUsername.
  // Do not treat requesterId/actorUserId/userId as primary profile targets —
  // those notifications navigate to action/home/detail first.
  if (canonicalUsername) return { username: canonicalUsername }
  return null
}

function resolveTypeMetadataTarget(
  type: string,
  meta: Record<string, unknown>,
): NotificationNavigationTarget | null {
  const action = resolveActionFromMetadata(type, meta)
  if (action) return action

  const profile = resolveProfileFromMetadata(type, meta)
  if (profile) return profile

  const postId = positiveId(meta.postId)
  if (type === 'post' && postId != null) {
    return { kind: 'home', postId }
  }

  if (type === 'zadatak') {
    return { kind: 'tasks' }
  }

  if (type === 'uplata') {
    return { kind: 'finances' }
  }

  if (type === 'subskripcija') {
    return { kind: 'home' }
  }

  return null
}

function resolveClubFromMetadata(meta: Record<string, unknown>): ClubNotificationTarget | null {
  const clubId = positiveId(meta.clubId)
  const clubName = trimString(meta.clubName) ?? trimString(meta.clubNaziv)
  if (clubId != null) {
    return clubName ? { kind: 'club', clubId, clubName } : { kind: 'club', clubId }
  }
  if (clubName) return { kind: 'club', clubName }
  return null
}

/**
 * Canonical resolver: metadata → link → notification detail → none.
 * Never throws; never navigates.
 */
export function resolveNotificationNavigationTarget(
  input: ObavestenjeNavigationInput,
): NotificationNavigationTarget {
  const type = (input.type ?? '').trim()
  const link = (input.link ?? '').trim()
  const meta = parseMetadata(input.metadata)
  const notificationId = positiveId(input.notificationId)

  const fromMeta = resolveTypeMetadataTarget(type, meta)
  if (fromMeta) return fromMeta

  // Stable clubId in metadata wins over stale /klubovi/{name} links.
  const clubFromMeta = resolveClubFromMetadata(meta)
  if (clubFromMeta?.clubId != null) return clubFromMeta

  if (link) {
    const fromLink = parseCanonicalNotificationLink(link)
    if (fromLink) {
      if (fromLink.kind === 'home' && positiveId(meta.postId) != null) {
        return { kind: 'home', postId: positiveId(meta.postId)! }
      }
      if (fromLink.kind === 'club') {
        return clubFromMeta ?? fromLink
      }
      return fromLink
    }
  }

  if (clubFromMeta) return clubFromMeta

  if (notificationId != null) {
    return { kind: 'notification-detail', notificationId }
  }

  return { kind: 'none' }
}

/** Build a web router path from a semantic target (null when none). */
export function buildWebNotificationPath(target: NotificationNavigationTarget): string | null {
  switch (target.kind) {
    case 'action': {
      const base = `/akcije/${target.actionId}`
      return target.claimReward ? `${base}?claimReward=1` : base
    }
    case 'profile':
      if (target.userId != null) return `/users/${target.userId}`
      if (target.username) return `/korisnik/${encodeURIComponent(target.username)}`
      return null
    case 'own-club':
      return '/klub'
    case 'club':
      // Web has no public-by-id route yet; name path remains for legacy/web.
      if (target.clubName) return `/klubovi/${encodeURIComponent(target.clubName)}`
      return null
    case 'guides':
      return '/vodici'
    case 'tasks':
      return '/zadaci'
    case 'finances':
      return '/finansije'
    case 'home':
      return target.postId != null ? `/home?postId=${target.postId}` : '/home'
    case 'notification-detail':
      return `/obavestenja/${target.notificationId}`
    case 'none':
      return null
    default:
      return null
  }
}

function mapSemanticToLegacy(target: NotificationNavigationTarget): ObavestenjeNavigationTarget {
  if (target.kind === 'action') {
    const path = buildWebNotificationPath(target)!
    return { kind: 'action', actionId: target.actionId, path }
  }
  if (target.kind === 'notification-detail') {
    return { kind: 'detail', path: null }
  }
  if (target.kind === 'none') {
    return { kind: 'detail', path: null }
  }
  const path = buildWebNotificationPath(target)
  if (path) return { kind: 'link', path }
  return { kind: 'detail', path: null }
}

/**
 * Legacy wrapper — prefer resolveNotificationNavigationTarget + buildWebNotificationPath.
 */
export function resolveObavestenjeNavigationTarget(
  input: ObavestenjeNavigationInput,
): ObavestenjeNavigationTarget {
  const semantic = resolveNotificationNavigationTarget(input)
  return mapSemanticToLegacy(semantic)
}

export function isActionCancelledNotificationType(type: string | null | undefined): boolean {
  return (type ?? '').trim() === NOTIFICATION_TYPE_ACTION_CANCELLED
}
