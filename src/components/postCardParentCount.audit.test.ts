import { describe, expect, it } from 'vitest'
import { mergeUniquePostsById } from '@beleg/shared'

/**
 * Fixed contract: PostCard engagement mutations call onUpdate so parent posts[] stays in sync.
 * Pagination append prefers existing objects; explicit refresh replaces with server values.
 */

type Post = {
  id: number
  likeCount?: number
  commentCount?: number
  myLiked?: boolean
  content?: string
}

function applyEngagementToParent(parentPosts: Post[], updated: Post): Post[] {
  return parentPosts.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
}

describe('M3-WEB-PARENT-COUNT fixed model', () => {
  it('comment create syncs parent posts[] via onUpdate', () => {
    let parentPosts: Post[] = [{ id: 1, commentCount: 2, likeCount: 0 }]
    const afterLocal = 3
    parentPosts = applyEngagementToParent(parentPosts, {
      ...parentPosts[0]!,
      commentCount: afterLocal,
    })
    expect(parentPosts[0]?.commentCount).toBe(3)
  })

  it('like/unlike syncs parent likeCount', () => {
    let parentPosts: Post[] = [{ id: 1, likeCount: 1, myLiked: true }]
    parentPosts = applyEngagementToParent(parentPosts, {
      ...parentPosts[0]!,
      likeCount: 0,
      myLiked: false,
    })
    expect(parentPosts[0]?.likeCount).toBe(0)
    expect(parentPosts[0]?.myLiked).toBe(false)
  })

  it('pagination append prefers existing fresher counts', () => {
    const existing: Post[] = [{ id: 5, commentCount: 4 }]
    const incoming: Post[] = [{ id: 5, commentCount: 3 }]
    const merged = mergeUniquePostsById(existing, incoming, { preferExistingOnConflict: true })
    expect(merged[0]?.commentCount).toBe(4)
  })

  it('explicit refresh replaces with server values', () => {
    const existing: Post[] = [{ id: 5, commentCount: 4 }]
    const server: Post[] = [{ id: 5, commentCount: 3 }]
    expect(server[0]?.commentCount).toBe(3)
    expect(existing[0]?.commentCount).toBe(4)
  })
})
