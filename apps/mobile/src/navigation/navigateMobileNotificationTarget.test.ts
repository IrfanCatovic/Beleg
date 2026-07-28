import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { NotificationNavigationTarget } from '@beleg/shared'

const isReady = vi.fn(() => true)
const navigate = vi.fn()

vi.mock('./navigationRef', () => ({
  navigationRef: {
    isReady,
    navigate,
  },
}))

describe('navigateMobileNotificationTarget', () => {
  beforeEach(() => {
    isReady.mockReturnValue(true)
    navigate.mockReset()
  })

  it('semantic action → ActionDetail with numeric id', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'action', actionId: 12 })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 12 },
    })
  })

  it('profile target with id → UserProfile id only', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(
      navigateMobileNotificationTarget({ kind: 'profile', userId: 42, username: 'stale' }),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'UserProfile',
      params: { id: 42 },
    })
  })

  it('profile target → UserProfile username when no id', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'profile', username: 'ana' })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'UserProfile',
      params: { username: 'ana' },
    })
  })

  it('unsupported club name → NotificationDetail fallback', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(
      navigateMobileNotificationTarget({ kind: 'club', clubName: 'Demo' }, 55),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'NotificationDetail',
      params: { id: 55 },
    })
  })

  it('claimReward action → detail fallback (route unsupported)', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(
      navigateMobileNotificationTarget({ kind: 'action', actionId: 3, claimReward: true }, 9),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'NotificationDetail',
      params: { id: 9 },
    })
  })

  it('none with notification id → detail fallback', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'none' }, 7)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'NotificationDetail',
      params: { id: 7 },
    })
  })

  it('navigator not ready → false', async () => {
    isReady.mockReturnValue(false)
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    const target: NotificationNavigationTarget = { kind: 'action', actionId: 1 }
    expect(navigateMobileNotificationTarget(target)).toBe(false)
  })
})
