import { describe, expect, it } from 'vitest'
import {
  parsePushNotificationData,
  resolveMobileNotificationNavigation,
  shouldInvalidateActionQueriesForPush,
  buildMobileNotificationNavigationKey,
  shouldSkipDuplicateNotificationNavigation,
} from './resolveMobileNotificationNavigation'

describe('resolveMobileNotificationNavigation', () => {
  it('in-app action_cancelled tap → ActionDetail', () => {
    expect(
      resolveMobileNotificationNavigation({
        type: 'action_cancelled',
        metadata: { akcijaId: 15 },
        obavestenjeId: 99,
      }),
    ).toEqual({ screen: 'ActionDetail', actionId: 15 })
  })

  it('background/cold-start string android data → ActionDetail', () => {
    expect(
      resolveMobileNotificationNavigation({
        pushData: {
          obavestenjeId: '3',
          type: 'action_cancelled',
          akcijaId: '42',
          isCancelled: 'true',
        },
      }),
    ).toEqual({ screen: 'ActionDetail', actionId: 42 })
  })

  it('iOS-style numeric payload uses same resolver', () => {
    expect(
      resolveMobileNotificationNavigation({
        pushData: {
          obavestenjeId: 8,
          type: 'action_cancelled',
          akcijaId: 11,
          isCancelled: true,
        },
      }),
    ).toEqual({ screen: 'ActionDetail', actionId: 11 })
  })

  it('missing/bad action id does not crash', () => {
    expect(
      resolveMobileNotificationNavigation({
        type: 'action_cancelled',
        pushData: { obavestenjeId: '1', akcijaId: 'x' },
        obavestenjeId: 1,
      }),
    ).toEqual({ screen: 'NotificationDetail', obavestenjeId: 1 })
    expect(parsePushNotificationData(undefined).actionId).toBeNull()
  })

  it('foreground invalidation helper returns action id once', () => {
    expect(
      shouldInvalidateActionQueriesForPush({
        type: 'action_cancelled',
        akcijaId: '5',
      }),
    ).toBe(5)
    expect(shouldInvalidateActionQueriesForPush({ type: 'akcija', akcijaId: '5' })).toBeNull()
  })

  it('ordinary notification still goes to NotificationDetail', () => {
    expect(
      resolveMobileNotificationNavigation({
        type: 'uplata',
        obavestenjeId: 4,
        pushData: { obavestenjeId: '4' },
      }),
    ).toEqual({ screen: 'NotificationDetail', obavestenjeId: 4 })
  })

  it('duplicate navigation guard skips same cold-start + response key', () => {
    const data = {
      obavestenjeId: '9',
      type: 'action_cancelled',
      akcijaId: '20',
      isCancelled: 'true',
    }
    const target = resolveMobileNotificationNavigation({ pushData: data })
    const key = buildMobileNotificationNavigationKey(target, data)
    expect(key).toBe('action:20:9')
    expect(shouldSkipDuplicateNotificationNavigation(null, key)).toBe(false)
    expect(shouldSkipDuplicateNotificationNavigation(key, key)).toBe(true)
    expect(shouldSkipDuplicateNotificationNavigation(key, 'action:21:9')).toBe(false)
  })
})
