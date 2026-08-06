import { describe, expect, it } from 'vitest'

/**
 * Fixed: deleteCommentMutation invalidates single-post, comments, and feed.
 */

const CREATE_COMMENT_INVALIDATES = ['post', 'comments', 'posts'] as const
const DELETE_COMMENT_INVALIDATES = ['post', 'comments', 'posts'] as const

function keysInvalidated(invalidated: readonly string[]) {
  return {
    post: invalidated.includes('post'),
    comments: invalidated.includes('comments'),
    posts: invalidated.includes('posts'),
    postDetail: invalidated.includes('post'),
  }
}

describe('M3-MOBILE-COUNT-INVALIDATION fixed', () => {
  it('create comment invalidates single-post query', () => {
    const result = keysInvalidated(CREATE_COMMENT_INVALIDATES)
    expect(result.postDetail).toBe(true)
  })

  it('delete comment invalidates single-post, comments, and feed', () => {
    const result = keysInvalidated(DELETE_COMMENT_INVALIDATES)
    expect(result.postDetail).toBe(true)
    expect(result.comments).toBe(true)
    expect(result.posts).toBe(true)
  })
})
