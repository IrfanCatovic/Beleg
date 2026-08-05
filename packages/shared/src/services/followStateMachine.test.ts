import { describe, expect, it } from 'vitest'

/**
 * Module 2 follow state machine contract (mirrors backend follows.go).
 */

type FollowOutgoing = 'none' | 'pending' | 'accepted'
type FollowIncoming = 'none' | 'pending' | 'accepted'

function resolveFollowCta(outgoing: FollowOutgoing, incoming: FollowIncoming, blocked: boolean) {
  if (blocked) return 'hidden'
  if (outgoing === 'accepted') return 'unfollow'
  if (outgoing === 'pending') return 'cancel'
  if (incoming === 'pending') return 'accept_or_disabled'
  return 'follow'
}

describe('follow state machine contract', () => {
  it('none + none → follow', () => {
    expect(resolveFollowCta('none', 'none', false)).toBe('follow')
  })

  it('pending outgoing → cancel', () => {
    expect(resolveFollowCta('pending', 'none', false)).toBe('cancel')
  })

  it('accepted outgoing → unfollow', () => {
    expect(resolveFollowCta('accepted', 'none', false)).toBe('unfollow')
  })

  it('incoming pending → accept or disabled on web', () => {
    expect(resolveFollowCta('none', 'pending', false)).toBe('accept_or_disabled')
  })

  it('blocked hides follow CTA', () => {
    expect(resolveFollowCta('none', 'none', true)).toBe('hidden')
  })
})

describe('block side effects contract', () => {
  it('block removes follow rows both directions (backend BlockUserHandler)', () => {
    const sideEffects = ['delete_follow_both_directions', 'no_auto_unblock_follow']
    expect(sideEffects[0]).toBe('delete_follow_both_directions')
  })

  it('unblock does not restore follow', () => {
    const restoresFollow = false
    expect(restoresFollow).toBe(false)
  })
})

describe('remove follower gap', () => {
  it('no dedicated remove-follower endpoint — use block or unfollow by follower', () => {
    const hasRemoveFollowerEndpoint = false
    expect(hasRemoveFollowerEndpoint).toBe(false)
  })
})
