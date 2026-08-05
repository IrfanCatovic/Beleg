import { describe, expect, it } from 'vitest'
import {
  decideFeedPostFocus,
  findPostIndexById,
  insertOrMovePostIntoFeedPages,
  insertOrMovePostIntoList,
  normalizeFeedPostId,
} from './feedPostFocus'

describe('normalizeFeedPostId', () => {
  it('accepts positive numbers and numeric strings', () => {
    expect(normalizeFeedPostId(42)).toBe(42)
    expect(normalizeFeedPostId('42')).toBe(42)
  })

  it('rejects invalid ids', () => {
    expect(normalizeFeedPostId(0)).toBeNull()
    expect(normalizeFeedPostId(-1)).toBeNull()
    expect(normalizeFeedPostId(Number.NaN)).toBeNull()
    expect(normalizeFeedPostId('')).toBeNull()
    expect(normalizeFeedPostId('x')).toBeNull()
    expect(normalizeFeedPostId(null)).toBeNull()
  })
})

describe('findPostIndexById / insert helpers', () => {
  it('finds loaded post index', () => {
    expect(findPostIndexById([{ id: 1 }, { id: 42 }, { id: 3 }], 42)).toBe(1)
    expect(findPostIndexById([{ id: 1 }], 99)).toBe(-1)
  })

  it('inserts missing post at front without duplicates on later pages', () => {
    const data = {
      pages: [
        { posts: [{ id: 1 }, { id: 2 }], total: 4 },
        { posts: [{ id: 3 }, { id: 42 }], total: 4 },
      ],
      pageParams: [0, 2],
    }
    const next = insertOrMovePostIntoFeedPages(data, { id: 42, content: 'x' } as { id: number; content: string })
    expect(next.pages[0]!.posts.map((p) => p.id)).toEqual([42, 1, 2])
    expect(next.pages[1]!.posts.map((p) => p.id)).toEqual([3])
    expect(next.pages.flatMap((p) => p.posts).filter((p) => p.id === 42)).toHaveLength(1)
  })

  it('dedupes when post later arrives via pagination shape', () => {
    const first = insertOrMovePostIntoFeedPages(
      { pages: [{ posts: [{ id: 1 }], total: 2 }], pageParams: [0] },
      { id: 9 },
    )
    const again = insertOrMovePostIntoFeedPages(first, { id: 9 })
    expect(again.pages[0]!.posts.filter((p) => p.id === 9)).toHaveLength(1)
  })

  it('flat list insertOrMove', () => {
    expect(insertOrMovePostIntoList([{ id: 2 }, { id: 3 }], { id: 1 }).map((p) => p.id)).toEqual([
      1, 2, 3,
    ])
    expect(insertOrMovePostIntoList([{ id: 1 }, { id: 2 }], { id: 2 }).map((p) => p.id)).toEqual([
      2, 1,
    ])
  })
})

describe('decideFeedPostFocus', () => {
  const base = {
    postId: 42,
    alreadyConsumed: false,
    listReady: true,
    loadedPostIds: [] as number[],
    fetchStatus: 'idle' as const,
  }

  it('invalid / consumed → noop', () => {
    expect(decideFeedPostFocus({ ...base, postId: null })).toEqual({ action: 'noop' })
    expect(decideFeedPostFocus({ ...base, alreadyConsumed: true })).toEqual({ action: 'noop' })
  })

  it('waits until list ready', () => {
    expect(decideFeedPostFocus({ ...base, listReady: false })).toEqual({ action: 'wait' })
  })

  it('scrolls when already loaded', () => {
    expect(
      decideFeedPostFocus({ ...base, loadedPostIds: [10, 42, 3], fetchStatus: 'idle' }),
    ).toEqual({ action: 'scroll', index: 1 })
  })

  it('fetches when missing', () => {
    expect(decideFeedPostFocus(base)).toEqual({ action: 'fetch' })
  })

  it('waits while loading/found pending insert', () => {
    expect(decideFeedPostFocus({ ...base, fetchStatus: 'loading' })).toEqual({ action: 'wait' })
    expect(decideFeedPostFocus({ ...base, fetchStatus: 'found' })).toEqual({ action: 'wait' })
  })

  it('not-found / error → consume without scroll', () => {
    expect(decideFeedPostFocus({ ...base, fetchStatus: 'missing' })).toEqual({
      action: 'consume-without-scroll',
    })
    expect(decideFeedPostFocus({ ...base, fetchStatus: 'error' })).toEqual({
      action: 'consume-without-scroll',
    })
  })

  it('refetch after consume does not scroll again', () => {
    expect(
      decideFeedPostFocus({
        ...base,
        alreadyConsumed: true,
        loadedPostIds: [42],
        fetchStatus: 'idle',
      }),
    ).toEqual({ action: 'noop' })
  })
})

/**
 * M3-CLIENT-DEDUP-1: after postId focus inserts an out-of-window post at the front,
 * consumers append the next page with offset=loadedLength and no id dedupe.
 * That produces duplicate ids (React key collision on web/mobile).
 * Document expected consumer contract: append must dedupe by id.
 */
describe('M3-CLIENT-DEDUP-1 feed focus insert then naive append', () => {
  it('documents duplicate when next page re-includes focused post', () => {
    const focused = { id: 99 }
    const afterFocus = insertOrMovePostIntoList([{ id: 1 }, { id: 2 }], focused)
    // Simulated next page from server that still contains 99 (natural position)
    const nextPage = [{ id: 3 }, { id: 99 }]
    const naiveAppend = [...afterFocus, ...nextPage]
    const dupCount = naiveAppend.filter((p) => p.id === 99).length
    if (dupCount > 1) {
      throw new Error(
        `M3-CLIENT-DEDUP-1 P2: naive append after focus insert duplicates postId; count=${dupCount} ids=${naiveAppend.map((p) => p.id).join(',')}`,
      )
    }
    expect(dupCount).toBe(1)
  })
})
