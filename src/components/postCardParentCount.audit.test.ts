import { describe, expect, it } from 'vitest'

/**
 * Audit model: web Home keeps posts[] parent state; PostCard owns local like/comment counts.
 * Mutations update local state only — onUpdate is called for post edit, not comment/like.
 */

type Post = {
  id: number
  likeCount?: number
  commentCount?: number
  myLiked?: boolean
  content?: string
}

function simulatePostCardLocalMutation(post: Post, delta: { likeCount?: number; commentCount?: number }) {
  return {
    localLikeCount: delta.likeCount ?? post.likeCount ?? 0,
    localCommentCount: delta.commentCount ?? post.commentCount ?? 0,
    parentPost: post,
  }
}

function simulateParentAfterComment(parentPosts: Post[], postId: number, newLocalCount: number) {
  const parent = parentPosts.find((p) => p.id === postId)
  return {
    parentCommentCount: parent?.commentCount ?? 0,
    childDisplayedCount: newLocalCount,
    parentStale: (parent?.commentCount ?? 0) !== newLocalCount,
  }
}

function simulatePaginationMerge(existing: Post[], incoming: Post[]) {
  const byId = new Map<number, Post>()
  for (const p of existing) byId.set(p.id, p)
  for (const p of incoming) {
    if (byId.has(p.id)) byId.set(p.id, p)
    else byId.set(p.id, p)
  }
  return Array.from(byId.values())
}

describe('M3-WEB-PARENT-COUNT audit model', () => {
  it('comment create updates child local count but not parent posts[]', () => {
    const parentPosts: Post[] = [{ id: 1, commentCount: 2, likeCount: 0 }]
    const after = simulatePostCardLocalMutation(parentPosts[0], { commentCount: 3 })
    const sync = simulateParentAfterComment(parentPosts, 1, after.localCommentCount)
    expect(sync.parentStale).toBe(true)
    expect(sync.childDisplayedCount).toBe(3)
    expect(sync.parentCommentCount).toBe(2)
  })

  it('like/unlike updates child local count but parent stays stale until refresh', () => {
    const parentPosts: Post[] = [{ id: 1, likeCount: 1, myLiked: true }]
    const afterUnlike = simulatePostCardLocalMutation(parentPosts[0], { likeCount: 0 })
    expect(afterUnlike.localLikeCount).toBe(0)
    expect(parentPosts[0].likeCount).toBe(1)
  })

  it('pagination merge with stale server row can overwrite fresher parent object', () => {
    const existing: Post[] = [{ id: 5, commentCount: 4 }]
    const incoming: Post[] = [{ id: 5, commentCount: 3 }]
    const merged = simulatePaginationMerge(existing, incoming)
    expect(merged[0]?.commentCount).toBe(3)
  })

  it('handleUpdatePost path syncs parent (post edit only)', () => {
    const parentPosts: Post[] = [{ id: 1, commentCount: 1, content: 'old' }]
    const updated: Post = { id: 1, commentCount: 1, content: 'new' }
    const next = parentPosts.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
    expect(next[0]?.content).toBe('new')
  })
})
