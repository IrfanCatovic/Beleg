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

  it('legacy follow semantic with requesterId → UserProfile { id }', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    const { resolveNotificationNavigationTarget } = await import('@beleg/shared')
    const semantic = resolveNotificationNavigationTarget({
      type: 'follow',
      link: '/korisnik/old',
      metadata: { followId: 1, requesterId: 42, requesterUsername: 'old' },
    })
    expect(semantic).toEqual({ kind: 'profile', userId: 42 })
    expect(navigateMobileNotificationTarget(semantic)).toBe(true)
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

  it('own-club → ClubHome', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'own-club' })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ClubTab', {
      screen: 'ClubHome',
      params: undefined,
    })
  })

  it('club with clubId → PublicClub', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(
      navigateMobileNotificationTarget({ kind: 'club', clubId: 42, clubName: 'stale' }),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'PublicClub',
      params: { clubId: 42 },
    })
  })

  it('club name-only → NotificationDetail fallback', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'club', clubName: 'Demo' }, 55)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'NotificationDetail',
      params: { id: 55 },
    })
  })

  it('home without postId → Feed', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'home' })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'Feed',
      params: undefined,
    })
  })

  it('home + postId → Feed with postId', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'home', postId: 42 })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'Feed',
      params: { postId: 42 },
    })
  })

  it('invalid home postId omitted', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'home', postId: 0 as unknown as number })).toBe(
      true,
    )
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'Feed',
      params: undefined,
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

  it('claimReward action → ActionDetail with claimReward', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(
      navigateMobileNotificationTarget({ kind: 'action', actionId: 3, claimReward: true }, 9),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 3, claimReward: true },
    })
  })

  it('invalid action falls through to NotificationDetail when id given', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'none' }, 9)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'NotificationDetail',
      params: { id: 9 },
    })
  })

  it('tasks/finances/club/profile are not regressed', async () => {
    const { navigateMobileNotificationTarget } = await import('./navigateMobileNotificationTarget')
    expect(navigateMobileNotificationTarget({ kind: 'tasks' })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ClubTab', { screen: 'Tasks', params: undefined })
    navigate.mockClear()
    expect(navigateMobileNotificationTarget({ kind: 'finances' })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ClubTab', { screen: 'Finance', params: undefined })
    navigate.mockClear()
    expect(navigateMobileNotificationTarget({ kind: 'own-club' })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ClubTab', { screen: 'ClubHome', params: undefined })
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
