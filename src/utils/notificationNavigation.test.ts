import { describe, expect, it } from 'vitest'
import { resolveWebNotificationPath } from './notificationNavigation'

describe('resolveWebNotificationPath', () => {
  it('action notification click → /akcije/:id', () => {
    expect(
      resolveWebNotificationPath({
        id: 1,
        type: 'akcija',
        link: '/akcije/15',
        metadata: JSON.stringify({ akcijaId: 15 }),
      }),
    ).toBe('/akcije/15')
  })

  it('cancelled/completed → same action detail', () => {
    expect(
      resolveWebNotificationPath({
        id: 2,
        type: 'action_cancelled',
        link: '/akcije/20',
        metadata: JSON.stringify({ akcijaId: 20, isCancelled: true }),
      }),
    ).toBe('/akcije/20')
  })

  it('summit reward keeps claimReward=1', () => {
    expect(
      resolveWebNotificationPath({
        id: 3,
        type: 'summit_reward',
        link: '/akcije/8?claimReward=1',
        metadata: JSON.stringify({ akcijaId: 8 }),
      }),
    ).toBe('/akcije/8?claimReward=1')
  })

  it('profile with targetUserId → /users/:id on web', () => {
    expect(
      resolveWebNotificationPath({
        id: 4,
        type: 'follow',
        link: '/korisnik/old-name',
        metadata: JSON.stringify({ targetUserId: 12, targetUsername: 'old-name' }),
      }),
    ).toBe('/users/12')
  })

  it('legacy follow requesterId → /users/:id', () => {
    expect(
      resolveWebNotificationPath({
        id: 8,
        type: 'follow',
        link: '/korisnik/stale',
        metadata: JSON.stringify({
          followId: 1,
          requesterId: 42,
          requesterUsername: 'stale',
        }),
      }),
    ).toBe('/users/42')
  })

  it('legacy follow accepted targetId → /users/:id', () => {
    expect(
      resolveWebNotificationPath({
        id: 9,
        type: 'follow',
        link: '',
        metadata: JSON.stringify({
          followId: 2,
          targetId: 55,
          targetUsername: 'old-accepter',
        }),
      }),
    ).toBe('/users/55')
  })

  it('username-only follow → username route', () => {
    expect(
      resolveWebNotificationPath({
        id: 4,
        type: 'follow',
        link: '',
        metadata: JSON.stringify({ followId: 1, requesterUsername: 'ana' }),
      }),
    ).toBe('/korisnik/ana')
  })

  it('stale username with valid id still uses id route', () => {
    expect(
      resolveWebNotificationPath({
        id: 6,
        type: 'follow',
        link: '/korisnik/renamed',
        metadata: JSON.stringify({ targetUserId: 99, targetUsername: 'old' }),
      }),
    ).toBe('/users/99')
  })

  it('follow with valid metadata → profile', () => {
    expect(
      resolveWebNotificationPath({
        id: 4,
        type: 'follow',
        link: '',
        metadata: JSON.stringify({ followId: 1, requesterUsername: 'ana' }),
      }),
    ).toBe('/korisnik/ana')
  })

  it('post with postId stays home path', () => {
    expect(
      resolveWebNotificationPath({
        id: 20,
        type: 'post',
        link: '/home',
        metadata: JSON.stringify({ postId: 99, actorUserId: 42 }),
      }),
    ).toBe('/home?postId=99')
  })

  it('empty-link participation → action', () => {
    expect(
      resolveWebNotificationPath({
        id: 5,
        type: 'action_participation_request',
        link: '',
        metadata: JSON.stringify({ akcijaId: 42, requestId: 9 }),
      }),
    ).toBe('/akcije/42')
  })

  it('unknown notification with id → detail', () => {
    expect(
      resolveWebNotificationPath({
        id: 77,
        type: 'broadcast',
        link: '',
      }),
    ).toBe('/obavestenja/77')
  })

  it('malformed link does not produce dead route', () => {
    expect(
      resolveWebNotificationPath({
        id: 10,
        type: 'akcija',
        link: '/akcija/12',
      }),
    ).toBe('/obavestenja/10')
  })

  it('static routes use existing paths', () => {
    expect(
      resolveWebNotificationPath({ id: 1, type: 'uplata', link: '/finansije' }),
    ).toBe('/finansije')
    expect(
      resolveWebNotificationPath({ id: 1, type: 'zadatak', link: '/zadaci' }),
    ).toBe('/zadaci')
    expect(
      resolveWebNotificationPath({
        id: 1,
        type: 'broadcast',
        link: '/klub',
        metadata: JSON.stringify({ clubJoinRequestId: 1 }),
      }),
    ).toBe('/klub')
  })
})
