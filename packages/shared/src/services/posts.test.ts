import { describe, expect, it } from 'vitest'
import { normalizePost } from './posts'

describe('normalizePost', () => {
  it('maps backend user and myLiked to author and likedByMe', () => {
    const post = normalizePost({
      id: 1,
      content: 'Hello',
      createdAt: '2026-06-21T10:00:00Z',
      imageUrl: 'https://example.com/img.jpg',
      likeCount: 3,
      commentCount: 1,
      user: {
        id: 42,
        username: 'farko',
        fullName: 'Farko F.',
        avatarUrl: 'https://example.com/av.jpg',
        isProfiGuide: true,
      },
      myLiked: true,
    })

    expect(post.author).toEqual({
      id: 42,
      username: 'farko',
      fullName: 'Farko F.',
      avatarUrl: 'https://example.com/av.jpg',
      isProfiGuide: true,
    })
    expect(post.likedByMe).toBe(true)
    expect(post.likeCount).toBe(3)
  })

  it('prefers user over author when both present', () => {
    const post = normalizePost({
      id: 2,
      content: 'x',
      createdAt: '2026-06-21T10:00:00Z',
      user: { id: 1, username: 'from_user' },
      author: { id: 2, username: 'from_author' },
      myLiked: false,
    })
    expect(post.author.username).toBe('from_user')
  })

  it('falls back to author and likedByMe when already normalized', () => {
    const post = normalizePost({
      id: 3,
      content: 'y',
      createdAt: '2026-06-21T10:00:00Z',
      author: { id: 5, username: 'legacy' },
      likedByMe: true,
    })
    expect(post.author.username).toBe('legacy')
    expect(post.likedByMe).toBe(true)
  })

  it('uses empty author when missing', () => {
    const post = normalizePost({
      id: 4,
      content: 'z',
      createdAt: '2026-06-21T10:00:00Z',
    })
    expect(post.author).toEqual({ id: 0, username: '' })
    expect(post.likedByMe).toBe(false)
  })
})
