import type { AkcijaListItem, FerrataRow, Korisnik, Post } from '@beleg/shared'
import { formatActionDateShort as formatSharedActionDateShort } from '@beleg/shared'

export interface MentionUser {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  isProfiGuide?: boolean
  klubId?: number | null
}

export type FeedItem =
  | { kind: 'action'; createdAtMs: number; action: AkcijaListItem; addedBy?: MentionUser }
  | { kind: 'post'; createdAtMs: number; post: Post }

export type HomeListItem =
  | FeedItem
  | { kind: 'suggested'; users: MentionUser[] }
  | { kind: 'ferrata'; ferrata: FerrataRow }

export function mergeAkcijeById(...lists: AkcijaListItem[][]): AkcijaListItem[] {
  const byId = new Map<number, AkcijaListItem>()
  for (const list of lists) {
    for (const a of list) byId.set(a.id, a)
  }
  return Array.from(byId.values())
}

export function isGuideOrganizedAkcija(a: AkcijaListItem): boolean {
  return (a.organizatorTip ?? 'klub').toLowerCase() === 'vodic'
}

export function resolveActionAuthor(
  action: AkcijaListItem,
  usersById: Map<number, MentionUser>,
): MentionUser | undefined {
  if (isGuideOrganizedAkcija(action) && typeof action.vodicId === 'number' && action.vodicId > 0) {
    return usersById.get(action.vodicId)
  }
  if (typeof action.addedById === 'number' && action.addedById > 0) {
    return usersById.get(action.addedById)
  }
  if (typeof action.vodicId === 'number' && action.vodicId > 0) {
    return usersById.get(action.vodicId)
  }
  return undefined
}

export function korisniciToMentionUsers(korisnici: Korisnik[]): MentionUser[] {
  return korisnici.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    avatar_url: u.avatar_url,
    isProfiGuide: u.isProfiGuide,
    klubId: u.klubId,
  }))
}

export function buildUsersById(users: MentionUser[]): Map<number, MentionUser> {
  const map = new Map<number, MentionUser>()
  for (const u of users) {
    if (typeof u.id === 'number') map.set(u.id, u)
  }
  return map
}

export function buildFeedItems(
  posts: Post[],
  aktivneAkcije: AkcijaListItem[],
  usersById: Map<number, MentionUser>,
): FeedItem[] {
  const actionItems: FeedItem[] = aktivneAkcije
    .filter((a) => !a.isCompleted)
    .map((action) => {
      const createdAtMs = action.createdAt ? new Date(action.createdAt).getTime() : 0
      return {
        kind: 'action' as const,
        createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
        action,
        addedBy: resolveActionAuthor(action, usersById),
      }
    })

  const postItems: FeedItem[] = posts.map((post) => {
    const createdAtMs = post.createdAt ? new Date(post.createdAt).getTime() : 0
    return {
      kind: 'post' as const,
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
      post,
    }
  })

  return [...actionItems, ...postItems].sort((a, b) => b.createdAtMs - a.createdAtMs)
}

function sortPostsByDateDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bMs - aMs
  })
}

export function buildHomeListItems(
  posts: Post[],
  aktivneAkcije: AkcijaListItem[],
  usersById: Map<number, MentionUser>,
  suggestedUsers: MentionUser[],
  randomFerrata: FerrataRow | null,
): HomeListItem[] {
  const sortedPosts = sortPostsByDateDesc(posts)
  const items: HomeListItem[] = []

  const [firstPost, ...remainingPosts] = sortedPosts
  if (firstPost) {
    const createdAtMs = firstPost.createdAt ? new Date(firstPost.createdAt).getTime() : 0
    items.push({
      kind: 'post',
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
      post: firstPost,
    })
  }

  if (suggestedUsers.length > 0) {
    items.push({ kind: 'suggested', users: suggestedUsers })
  }

  if (randomFerrata) {
    items.push({ kind: 'ferrata', ferrata: randomFerrata })
  }

  const rest = buildFeedItems(remainingPosts, aktivneAkcije, usersById)
  items.push(...rest)

  return items
}

export function pickRandomFerrata(ferrate: FerrataRow[]): FerrataRow | null {
  const withSlug = ferrate.filter((f) => f.slug?.trim())
  if (!withSlug.length) return null
  const index = Math.floor(Math.random() * withSlug.length)
  return withSlug[index] ?? null
}

export function pickSuggestedUsers(
  discoverUsers: MentionUser[],
  followingUserIds: number[],
  ownKlubId: number | null | undefined,
  count = 2,
): MentionUser[] {
  const blockedIds = new Set<number>(followingUserIds)
  const pool = discoverUsers.filter((u) => {
    if (blockedIds.has(u.id)) return false
    if (typeof ownKlubId === 'number' && typeof u.klubId === 'number' && u.klubId === ownKlubId) {
      return false
    }
    return true
  })
  return shuffleAndTake(pool, count)
}

function shuffleAndTake<T>(arr: T[], count: number): T[] {
  if (!Array.isArray(arr) || arr.length === 0 || count <= 0) return []
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

export function formatDateShort(datum?: string): string {
  return formatSharedActionDateShort(datum)
}

export function difficultyBadgeStyle(tezina?: string, tipAkcije?: string): { bg: string; text: string; label: string } {
  if (tipAkcije === 'via_ferrata') {
    const s = (tezina ?? '').toUpperCase()
    if (s.includes('E')) return { bg: '#0f172a', text: '#ffffff', label: tezina ?? 'E' }
    if (s.includes('D')) return { bg: '#f43f5e', text: '#ffffff', label: tezina ?? 'D' }
    if (s.includes('C')) return { bg: '#d97706', text: '#ffffff', label: tezina ?? 'C' }
    if (s.includes('B')) return { bg: '#0ea5e9', text: '#ffffff', label: tezina ?? 'B' }
    if (s.includes('A')) return { bg: '#059669', text: '#ffffff', label: tezina ?? 'A' }
  }
  const k = (tezina ?? '').toLowerCase()
  if (k.includes('alpin')) return { bg: '#ede9fe', text: '#6d28d9', label: tezina ?? 'Alpinistička' }
  if (k.includes('tešk') || k.includes('tesk')) return { bg: '#ffe4e6', text: '#be123c', label: tezina ?? 'Teška' }
  if (k.includes('sred')) return { bg: '#fef3c7', text: '#b45309', label: tezina ?? 'Srednja' }
  if (k.includes('lak')) return { bg: '#d1fae5', text: '#047857', label: tezina ?? 'Laka' }
  return { bg: '#f1f5f9', text: '#64748b', label: tezina ?? '' }
}
