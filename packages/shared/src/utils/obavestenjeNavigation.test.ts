import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_TYPE_ACTION_CANCELLED,
  buildWebNotificationPath,
  getNotificationActionId,
  isActionCancelledNotificationType,
  parseCanonicalNotificationLink,
  resolveNotificationNavigationTarget,
  resolveObavestenjeNavigationTarget,
} from './obavestenjeNavigation'

describe('obavestenjeNavigation (legacy)', () => {
  it('exposes action_cancelled as known type string', () => {
    expect(NOTIFICATION_TYPE_ACTION_CANCELLED).toBe('action_cancelled')
    expect(isActionCancelledNotificationType('action_cancelled')).toBe(true)
    expect(isActionCancelledNotificationType('unknown_future_type')).toBe(false)
  })

  it('unknown type with no link falls back safely', () => {
    expect(resolveObavestenjeNavigationTarget({ type: 'brand_new_type' })).toEqual({
      kind: 'detail',
      path: null,
    })
  })

  it('resolves action_cancelled to action detail route', () => {
    expect(
      resolveObavestenjeNavigationTarget({
        type: 'action_cancelled',
        link: '/akcije/12',
        metadata: JSON.stringify({ akcijaId: 12, isCancelled: true }),
      }),
    ).toEqual({ kind: 'action', actionId: 12, path: '/akcije/12' })
  })

  it('missing action id does not crash', () => {
    expect(
      resolveObavestenjeNavigationTarget({
        type: 'action_cancelled',
        metadata: '{not-json',
      }),
    ).toEqual({ kind: 'detail', path: null })
    expect(getNotificationActionId({})).toBeNull()
    expect(getNotificationActionId({ akcijaId: 'nope' })).toBeNull()
  })

  it('accepts actionId fallback and string android-style ids', () => {
    expect(getNotificationActionId({ actionId: '99' })).toBe(99)
    expect(
      resolveObavestenjeNavigationTarget({
        type: 'action_cancelled',
        metadata: { akcijaId: '7', type: 'action_cancelled', isCancelled: 'true' },
      }),
    ).toEqual({ kind: 'action', actionId: 7, path: '/akcije/7' })
  })
})

describe('resolveNotificationNavigationTarget', () => {
  it('/akcije/12 → action 12', () => {
    expect(
      resolveNotificationNavigationTarget({ type: 'akcija', link: '/akcije/12' }),
    ).toEqual({ kind: 'action', actionId: 12 })
    expect(buildWebNotificationPath({ kind: 'action', actionId: 12 })).toBe('/akcije/12')
  })

  it('/akcije/12?claimReward=1 → action + claimReward', () => {
    expect(
      resolveNotificationNavigationTarget({ type: 'summit_reward', link: '/akcije/12?claimReward=1' }),
    ).toEqual({ kind: 'action', actionId: 12, claimReward: true })
    expect(
      buildWebNotificationPath({ kind: 'action', actionId: 12, claimReward: true }),
    ).toBe('/akcije/12?claimReward=1')
  })

  it('akcijaId string "12" → action 12', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'action_participation_request',
        metadata: { akcijaId: '12' },
      }),
    ).toEqual({ kind: 'action', actionId: 12 })
  })

  it('actionId=12 fallback → action 12', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'action_signup_request',
        metadata: { actionId: 12 },
      }),
    ).toEqual({ kind: 'action', actionId: 12 })
  })

  it('completed/cancelled → same action destination', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'action_cancelled',
        metadata: { akcijaId: 5, isCancelled: true },
      }),
    ).toEqual({ kind: 'action', actionId: 5 })
  })

  it('/korisnik/amar → profile amar', () => {
    expect(
      resolveNotificationNavigationTarget({ type: 'follow', link: '/korisnik/amar' }),
    ).toEqual({ kind: 'profile', username: 'amar' })
    expect(buildWebNotificationPath({ kind: 'profile', username: 'amar' })).toBe('/korisnik/amar')
  })

  it('encoded username decodes safely', () => {
    expect(parseCanonicalNotificationLink('/korisnik/Demo%20user')).toEqual({
      kind: 'profile',
      username: 'Demo user',
    })
  })

  it('malformed encoded username does not throw', () => {
    expect(parseCanonicalNotificationLink('/korisnik/%E0%A4%A')).toBeNull()
    expect(() =>
      resolveNotificationNavigationTarget({ link: '/korisnik/%E0%A4%A', notificationId: 1 }),
    ).not.toThrow()
  })

  it('static routes', () => {
    expect(parseCanonicalNotificationLink('/klub')).toEqual({ kind: 'own-club' })
    expect(parseCanonicalNotificationLink('/klubovi/Demo%20klub')).toEqual({
      kind: 'club',
      clubName: 'Demo klub',
    })
    expect(parseCanonicalNotificationLink('/klubovi/Planina%2B')).toEqual({
      kind: 'club',
      clubName: 'Planina+',
    })
    expect(parseCanonicalNotificationLink('/klubovi/Klub%2FRegion')).toEqual({
      kind: 'club',
      clubName: 'Klub/Region',
    })
    expect(parseCanonicalNotificationLink('/klubovi/Klub%3FTest')).toEqual({
      kind: 'club',
      clubName: 'Klub?Test',
    })
    expect(parseCanonicalNotificationLink('/klubovi/Klub%231')).toEqual({
      kind: 'club',
      clubName: 'Klub#1',
    })
    expect(parseCanonicalNotificationLink('/vodici')).toEqual({ kind: 'guides' })
    expect(parseCanonicalNotificationLink('/zadaci')).toEqual({ kind: 'tasks' })
    expect(parseCanonicalNotificationLink('/finansije')).toEqual({ kind: 'finances' })
    expect(parseCanonicalNotificationLink('/home')).toEqual({ kind: 'home' })
    expect(parseCanonicalNotificationLink('/obavestenja/25')).toEqual({
      kind: 'notification-detail',
      notificationId: 25,
    })
  })

  it('clubId metadata wins over stale club name link', () => {
    expect(
      resolveNotificationNavigationTarget({
        link: '/klubovi/old-name',
        metadata: { clubId: 42, clubName: 'stale' },
      }),
    ).toEqual({ kind: 'club', clubId: 42, clubName: 'stale' })
  })

  it('clubId-only metadata is valid club target', () => {
    expect(
      resolveNotificationNavigationTarget({
        metadata: { clubId: 7 },
      }),
    ).toEqual({ kind: 'club', clubId: 7 })
  })

  it('buildWebNotificationPath uses name; id-only returns null', () => {
    expect(buildWebNotificationPath({ kind: 'club', clubName: 'Demo Klub' })).toBe(
      '/klubovi/Demo%20Klub',
    )
    expect(buildWebNotificationPath({ kind: 'club', clubId: 3 })).toBeNull()
  })

  it('external URL → invalid/fallback to detail when id known', () => {
    expect(parseCanonicalNotificationLink('https://evil.com/akcije/1')).toBeNull()
    expect(
      resolveNotificationNavigationTarget({
        link: 'https://evil.com/akcije/1',
        notificationId: 3,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 3 })
  })

  it('dead paths → invalid/fallback', () => {
    expect(parseCanonicalNotificationLink('/akcija/12')).toBeNull()
    expect(parseCanonicalNotificationLink('/actions/12')).toBeNull()
    expect(parseCanonicalNotificationLink('/profil')).toBeNull()
    expect(parseCanonicalNotificationLink('/profile/ana')).toBeNull()
    expect(parseCanonicalNotificationLink('/user/12')).toBeNull()
    expect(parseCanonicalNotificationLink('/guides/1')).toBeNull()
    expect(
      resolveNotificationNavigationTarget({ link: '/akcija/12', notificationId: 8 }),
    ).toEqual({ kind: 'notification-detail', notificationId: 8 })
  })

  it('empty link + participation meta → action', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'action_participation_request',
        link: '',
        metadata: { akcijaId: 33, requestId: 1 },
        notificationId: 9,
      }),
    ).toEqual({ kind: 'action', actionId: 33 })
  })

  it('empty link + valid follow requester → profile', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '',
        metadata: { followId: 1, requesterUsername: 'ana' },
        notificationId: 2,
      }),
    ).toEqual({ kind: 'profile', username: 'ana' })
  })

  it('empty link + follow accepted targetUsername → profile', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '',
        metadata: { followId: 1, targetUsername: 'marko' },
      }),
    ).toEqual({ kind: 'profile', username: 'marko' })
  })

  it('targetUserId → profile with stable id only', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        metadata: { targetUserId: 42, targetUsername: 'ana' },
      }),
    ).toEqual({ kind: 'profile', userId: 42 })
    expect(buildWebNotificationPath({ kind: 'profile', userId: 42 })).toBe('/users/42')
  })

  it('targetUserId has priority over stale username and profile link', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '/korisnik/old-name',
        metadata: { targetUserId: 9, targetUsername: 'old-name' },
      }),
    ).toEqual({ kind: 'profile', userId: 9 })
    expect(
      buildWebNotificationPath({
        kind: 'profile',
        userId: 9,
        username: 'renamed-later',
      }),
    ).toBe('/users/9')
  })

  it('username rename does not break navigation when targetUserId exists', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '/korisnik/old-name',
        metadata: { targetUserId: 15, targetUsername: 'old-name' },
      }),
    ).toEqual({ kind: 'profile', userId: 15 })
  })

  it('profile with only username still works', () => {
    expect(
      resolveNotificationNavigationTarget({ type: 'follow', link: '/korisnik/amar' }),
    ).toEqual({ kind: 'profile', username: 'amar' })
    expect(buildWebNotificationPath({ kind: 'profile', username: 'amar' })).toBe('/korisnik/amar')
  })

  it('invalid profile target falls back to notification detail', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'follow',
        link: '',
        metadata: {},
        notificationId: 3,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 3 })
  })

  it('parses /users/:id profile route', () => {
    expect(parseCanonicalNotificationLink('/users/55')).toEqual({
      kind: 'profile',
      userId: 55,
    })
  })

  it('empty link without metadata + notification ID → detail', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'broadcast',
        link: '',
        notificationId: 44,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 44 })
  })

  it('malformed payload → none', () => {
    expect(resolveNotificationNavigationTarget({ type: null, link: null })).toEqual({ kind: 'none' })
  })

  it('does not throw for nullish/wrong types', () => {
    expect(() => resolveNotificationNavigationTarget({})).not.toThrow()
    expect(() => resolveNotificationNavigationTarget({ metadata: 42 as unknown as string })).not.toThrow()
  })

  it('metadata wins over empty/wrong link for post mention (postId → home)', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'post',
        link: '/korisnik/recipient',
        metadata: { postId: 99 },
        notificationId: 5,
      }),
    ).toEqual({ kind: 'home', postId: 99 })
  })

  it('home without postId → /home; with postId → query', () => {
    expect(buildWebNotificationPath({ kind: 'home' })).toBe('/home')
    expect(buildWebNotificationPath({ kind: 'home', postId: 42 })).toBe('/home?postId=42')
    expect(parseCanonicalNotificationLink('/home?postId=42')).toEqual({
      kind: 'home',
      postId: 42,
    })
    expect(parseCanonicalNotificationLink('/home?postId=0')).toEqual({ kind: 'home' })
    expect(parseCanonicalNotificationLink('/home?postId=bad')).toEqual({ kind: 'home' })
  })

  it('metadata action wins over malformed link', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'action_cancelled',
        link: '/akcija/bad',
        metadata: { akcijaId: 7 },
        notificationId: 1,
      }),
    ).toEqual({ kind: 'action', actionId: 7 })
  })

  it('guide booking without action id → detail fallback', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'guide_booking_request',
        link: '',
        metadata: { bookingRequestId: 3 },
        notificationId: 12,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 12 })
  })

  it('rejects 0, negative, NaN ids', () => {
    expect(
      resolveNotificationNavigationTarget({
        type: 'akcija',
        link: '/akcije/0',
        notificationId: 1,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 1 })
    expect(
      resolveNotificationNavigationTarget({
        type: 'action_cancelled',
        metadata: { akcijaId: -1 },
        notificationId: 2,
      }),
    ).toEqual({ kind: 'notification-detail', notificationId: 2 })
  })
})
