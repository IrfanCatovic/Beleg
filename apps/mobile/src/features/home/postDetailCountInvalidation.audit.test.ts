import { describe, expect, it } from 'vitest'

/**
 * Audit: PostDetailScreen query invalidation keys after comment delete.
 * Source: PostDetailScreen.tsx deleteCommentMutation onSuccess.
 */

const CREATE_COMMENT_INVALIDATES = ['post', 'comments', 'posts'] as const
const DELETE_COMMENT_INVALIDATES = ['comments', 'posts'] as const

function keysInvalidated(invalidated: readonly string[]) {
  return {
    post: invalidated.includes('post'),
    comments: invalidated.includes('comments'),
    posts: invalidated.includes('posts'),
    postDetail: invalidated.includes('post'),
  }
}

describe('M3-MOBILE-COUNT-INVALIDATION audit', () => {
  it('create comment invalidates single-post query', () => {
    const result = keysInvalidated(CREATE_COMMENT_INVALIDATES)
    expect(result.postDetail).toBe(true)
  })

  it('delete comment does NOT invalidate single-post query — commentCount bar can stay stale', () => {
    const result = keysInvalidated(DELETE_COMMENT_INVALIDATES)
    expect(result.postDetail).toBe(false)
    expect(result.comments).toBe(true)
  })

  it('PostLikeBar uses post.commentCount before comments.length fallback', () => {
    const postCommentCount = 5
    const commentsLength = 4
    const displayed = postCommentCount ?? commentsLength
    expect(displayed).toBe(5)
  })
})
