/** Positive finite post id, or null when invalid. */
export function normalizeFeedPostId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number.parseInt(value, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return null
}

export function findPostIndexById<T extends { id: number }>(
  posts: readonly T[],
  postId: number,
): number {
  return posts.findIndex((p) => p.id === postId)
}

/**
 * Insert post at the front of the first page (or move there) without duplicates.
 * Pagination cursors (pageParams / offsets from loaded lengths) stay usable.
 */
export function insertOrMovePostIntoFeedPages<T extends { id: number }>(
  data:
    | {
        pages: Array<{ posts: T[]; total: number }>
        pageParams: unknown[]
      }
    | undefined
    | null,
  post: T,
): {
  pages: Array<{ posts: T[]; total: number }>
  pageParams: unknown[]
} {
  if (!data || data.pages.length === 0) {
    return {
      pages: [{ posts: [post], total: 1 }],
      pageParams: [0],
    }
  }

  let existed = false
  const pages = data.pages.map((page) => {
    const filtered = page.posts.filter((p) => {
      if (p.id === post.id) {
        existed = true
        return false
      }
      return true
    })
    return { ...page, posts: filtered }
  })

  const first = pages[0]!
  pages[0] = {
    ...first,
    posts: [post, ...first.posts],
    total: existed ? first.total : Math.max(first.total, first.posts.length + 1),
  }

  return { pages, pageParams: [...data.pageParams] }
}

/** Flat array variant for web Home local state. */
export function insertOrMovePostIntoList<T extends { id: number }>(
  posts: readonly T[],
  post: T,
): T[] {
  const without = posts.filter((p) => p.id !== post.id)
  return [post, ...without]
}

export type FeedPostFetchStatus = 'idle' | 'loading' | 'found' | 'missing' | 'error'

export type FeedPostFocusDecision =
  | { action: 'noop' }
  | { action: 'wait' }
  | { action: 'scroll'; index: number }
  | { action: 'fetch' }
  | { action: 'consume-without-scroll' }

/**
 * One-shot feed focus decision for a postId intent.
 * Does not scroll on refetch once consumed; a new explicit postId starts fresh.
 */
export function decideFeedPostFocus(input: {
  postId: number | null
  alreadyConsumed: boolean
  listReady: boolean
  loadedPostIds: readonly number[]
  fetchStatus: FeedPostFetchStatus
}): FeedPostFocusDecision {
  if (input.postId == null || input.postId <= 0) return { action: 'noop' }
  if (input.alreadyConsumed) return { action: 'noop' }
  if (!input.listReady) return { action: 'wait' }

  const index = input.loadedPostIds.indexOf(input.postId)
  if (index >= 0) return { action: 'scroll', index }

  if (input.fetchStatus === 'idle') return { action: 'fetch' }
  if (input.fetchStatus === 'loading') return { action: 'wait' }
  if (input.fetchStatus === 'found') return { action: 'wait' }
  return { action: 'consume-without-scroll' }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function scrollPostElementIntoView(el: Element): void {
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'center',
  })
}
