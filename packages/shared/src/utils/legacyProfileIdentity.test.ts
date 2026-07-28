import { describe, expect, it } from 'vitest'
import {
  buildWebNotificationPath,
  resolveLegacyProfileIdentity,
  resolveNotificationNavigationTarget,
} from './obavestenjeNavigation'

/**
 * Historical fixtures mirror creators in follows.go / posts_* / guidebooking / participation.
 * Shapes are based on audit of metadata writers (legacy before P1B targetUserId, and current).
 */
describe('resolveLegacyProfileIdentity (type-aware)', () => {
  it('canonical targetUserId wins over everything', () => {
    expect(
      resolveLegacyProfileIdentity('follow', {
        targetUserId: 42,
        requesterId: 7,
        targetId: 9,
        targetUsername: 'stale',
      }),
    ).toEqual({ userId: 42 })
  })

  it('numeric string targetUserId normalizes', () => {
    expect(resolveLegacyProfileIdentity('follow', { targetUserId: '42' })).toEqual({
      userId: 42,
    })
  })

  it('rejects invalid ids', () => {
    expect(resolveLegacyProfileIdentity('follow', { targetUserId: 0 })).toBeNull()
    expect(resolveLegacyProfileIdentity('follow', { targetUserId: -1 })).toBeNull()
    expect(resolveLegacyProfileIdentity('follow', { targetUserId: 1.5 })).toBeNull()
    expect(resolveLegacyProfileIdentity('follow', { targetUserId: '1.5' })).toBeNull()
    expect(resolveLegacyProfileIdentity('follow', { targetUserId: Number.NaN })).toBeNull()
    expect(resolveLegacyProfileIdentity('follow', { requesterId: 0 })).toBeNull()
  })

  it('unknown type does not use generic requesterId', () => {
    expect(
      resolveLegacyProfileIdentity('mystery_type', {
        requesterId: 42,
        requesterUsername: 'x',
      }),
    ).toBeNull()
  })

  it('malformed metadata is safe', () => {
    expect(resolveLegacyProfileIdentity('follow', null)).toBeNull()
    expect(resolveLegacyProfileIdentity('follow', [])).toBeNull()
    expect(resolveLegacyProfileIdentity('follow', 'nope')).toBeNull()
    expect(resolveLegacyProfileIdentity(undefined, undefined)).toBeNull()
  })
})

describe('historical follow fixtures', () => {
  // Creator: CreateFollowRequestHandler — notify follow target about requester.
  it('legacy follow request: requesterId → requester profile (not recipient)', () => {
    const recipientId = 10
    const requesterId = 42
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '',
        metadata: {
          followId: 5,
          requesterId,
          requesterUsername: 'old-requester',
          // recipient is NOT in metadata; ensure we never invent recipientId
          _recipientHint: recipientId,
        },
      }),
    ).toEqual({ kind: 'profile', userId: 42 })
    expect(buildWebNotificationPath({ kind: 'profile', userId: 42 })).toBe('/users/42')
  })

  // Creator: AcceptFollowRequestHandler — notify requester that target accepted.
  it('legacy follow accepted: targetId → accepter profile (not original requester)', () => {
    const originalRequesterId = 10
    const accepterId = 42
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '',
        metadata: {
          followId: 5,
          targetId: accepterId,
          targetUsername: 'old-accepter',
          // If requesterId were wrongly present as the recipient of the notif, prefer
          // request shape only when requesterId is the only id — accepted shape uses targetId.
          // Historical accepted payloads do not include requesterId.
          _originalRequesterHint: originalRequesterId,
        },
      }),
    ).toEqual({ kind: 'profile', userId: 42 })
  })

  it('follow accepted does not open requester when only targetId is present', () => {
    expect(
      resolveLegacyProfileIdentity('follow', {
        followId: 1,
        targetId: 42,
        targetUsername: 'marko',
      }),
    ).toEqual({ userId: 42, username: 'marko' })
  })

  it('follow request requesterId beats stale profile link', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '/korisnik/stale-name',
        metadata: { followId: 1, requesterId: 42, requesterUsername: 'stale-name' },
      }),
    ).toEqual({ kind: 'profile', userId: 42 })
  })

  it('username-only legacy follow still works (not rename-safe)', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '',
        metadata: { followId: 1, requesterUsername: 'amar' },
      }),
    ).toEqual({ kind: 'profile', username: 'amar' })
  })

  it('empty username → notification detail fallback', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '',
        metadata: { followId: 1, requesterUsername: '   ' },
        notificationId: 3,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 3 })
  })
})

describe('historical non-profile fixtures stay protected', () => {
  // Creator: posts like/comment/mention — primary destination is feed/home.
  it('legacy post like { postId } stays home, ignores actor as primary', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'post',
        link: '/home',
        metadata: { postId: 99 },
      }),
    ).toEqual({ kind: 'home', postId: 99 })
    expect(
      resolveNotificationNavigationTarget({
        type: 'post',
        link: '/home',
        metadata: { postId: 99, actorUserId: 42, actorUsername: 'liker' },
      }),
    ).toEqual({ kind: 'home', postId: 99 })
  })

  // Creator: action_participation_requests.go — action wins over requesterId.
  it('participation request with requesterId stays action', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'action_participation_request',
        link: '/akcije/7',
        metadata: {
          akcijaId: 7,
          requestId: 3,
          requesterId: 42,
          requesterUsername: 'org',
        },
      }),
    ).toEqual({ kind: 'action', actionId: 7 })
  })

  // Creator: guidebooking/notify.go — pending booking has no action id → detail.
  it('guide request with requesterId stays detail (not profile)', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'guide_booking_request',
        link: '',
        metadata: {
          bookingRequestId: 3,
          requesterId: 42,
          requesterUsername: 'guest',
        },
        notificationId: 12,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 12 })
  })

  it('guide fulfilled with akcijaId stays action', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'guide_booking_request',
        link: '/akcije/8',
        metadata: { akcijaId: 8, bookingRequestId: 3, requesterId: 42 },
      }),
    ).toEqual({ kind: 'action', actionId: 8 })
  })
})
