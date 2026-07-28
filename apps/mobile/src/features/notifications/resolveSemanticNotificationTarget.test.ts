import { describe, expect, it } from 'vitest'
import {
  parsePushNotificationData,
  resolveMobileNotificationNavigation,
  resolveSemanticNotificationTarget,
  semanticToMobileNavTarget,
} from './resolveMobileNotificationNavigation'

describe('resolveSemanticNotificationTarget (mobile)', () => {
  it('empty participation link + action meta → action', () => {
    expect(
      resolveSemanticNotificationTarget({
        type: 'action_participation_request',
        link: '',
        metadata: { akcijaId: 42, requestId: 1 },
        obavestenjeId: 5,
      }),
    ).toEqual({ kind: 'action', actionId: 42 })
    expect(
      resolveMobileNotificationNavigation({
        type: 'action_participation_request',
        link: '',
        metadata: { akcijaId: 42 },
        obavestenjeId: 5,
      }),
    ).toEqual({ screen: 'ActionDetail', actionId: 42 })
  })

  it('empty follow link + requester username → profile semantic, detail pending adapter', () => {
    const semantic = resolveSemanticNotificationTarget({
      type: 'follow',
      link: '',
      metadata: { followId: 1, requesterUsername: 'ana' },
      obavestenjeId: 8,
    })
    expect(semantic).toEqual({ kind: 'profile', username: 'ana' })
    expect(semanticToMobileNavTarget(semantic, 8)).toEqual({
      screen: 'NotificationDetail',
      obavestenjeId: 8,
    })
  })

  it('malformed payload → none / detail fallback', () => {
    expect(
      resolveMobileNotificationNavigation({
        type: 'broadcast',
        link: '/akcija/bad',
        obavestenjeId: 3,
      }),
    ).toEqual({ screen: 'NotificationDetail', obavestenjeId: 3 })
    expect(parsePushNotificationData({ obavestenjeId: 'x' }).obavestenjeId).toBeNull()
  })

  it('summit reward with claimReward maps to ActionDetail', () => {
    expect(
      resolveMobileNotificationNavigation({
        type: 'summit_reward',
        metadata: { akcijaId: 9 },
        obavestenjeId: 2,
      }),
    ).toEqual({ screen: 'ActionDetail', actionId: 9, claimReward: true })
    expect(
      semanticToMobileNavTarget({ kind: 'action', actionId: 9, claimReward: true }, 2),
    ).toEqual({ screen: 'ActionDetail', actionId: 9, claimReward: true })
  })

  it('ordinary action without claimReward omits the flag', () => {
    expect(
      semanticToMobileNavTarget({ kind: 'action', actionId: 4 }, 1),
    ).toEqual({ screen: 'ActionDetail', actionId: 4 })
  })
})
