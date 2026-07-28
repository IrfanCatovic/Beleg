import { describe, expect, it, vi, beforeEach } from 'vitest'

const isReady = vi.fn(() => true)
const navigate = vi.fn()

vi.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady,
    navigate,
  }),
}))

describe('navigateFromDeepLinkUrl claimReward params', () => {
  beforeEach(() => {
    isReady.mockReturnValue(true)
    navigate.mockReset()
  })

  it('plain URL → ActionDetail { id }', async () => {
    const { navigateFromDeepLinkUrl } = await import('./navigationRef')
    expect(navigateFromDeepLinkUrl('planiner://akcije/42')).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 42 },
    })
  })

  it('reward URL → { id, claimReward: true }', async () => {
    const { navigateFromDeepLinkUrl } = await import('./navigationRef')
    expect(navigateFromDeepLinkUrl('https://www.planiner.com/akcije/42?claimReward=1')).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 42, claimReward: true },
    })
  })

  it('invite URL → { id, inviteToken }', async () => {
    const { navigateFromDeepLinkUrl } = await import('./navigationRef')
    expect(navigateFromDeepLinkUrl('/akcije/42?inviteToken=abc')).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 42, inviteToken: 'abc' },
    })
  })

  it('invite + reward → all three params', async () => {
    const { navigateFromDeepLinkUrl } = await import('./navigationRef')
    expect(navigateFromDeepLinkUrl('/akcije/42?inviteToken=abc&claimReward=1')).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 42, inviteToken: 'abc', claimReward: true },
    })
  })

  it('invalid claim does not send claimReward: false', async () => {
    const { navigateFromDeepLinkUrl } = await import('./navigationRef')
    expect(navigateFromDeepLinkUrl('/akcije/42?claimReward=0')).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 42 },
    })
    const params = navigate.mock.calls[0]![1].params as Record<string, unknown>
    expect(params).not.toHaveProperty('claimReward')
  })

  it('invalid action id → false / no navigate', async () => {
    const { navigateFromDeepLinkUrl } = await import('./navigationRef')
    expect(navigateFromDeepLinkUrl('/akcije/0?claimReward=1')).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })
})
