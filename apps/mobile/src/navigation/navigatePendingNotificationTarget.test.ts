import { describe, expect, it, vi, beforeEach } from 'vitest'

const navigate = vi.fn()
const isReady = vi.fn(() => true)

vi.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady,
    navigate,
  }),
}))

describe('navigatePendingNotificationTarget', () => {
  beforeEach(() => {
    navigate.mockClear()
    isReady.mockReturnValue(true)
  })

  it('notification-detail → HomeTab / NotificationDetail', async () => {
    const { navigatePendingNotificationTarget } = await import('./navigationRef')
    expect(
      navigatePendingNotificationTarget({
        kind: 'notification-detail',
        notificationId: 4,
        dedupeKey: 'notif:4',
      }),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'NotificationDetail',
      params: { id: 4 },
    })
  })

  it('action-detail → ActionsTab / ActionDetail with inviteToken', async () => {
    const { navigatePendingNotificationTarget } = await import('./navigationRef')
    expect(
      navigatePendingNotificationTarget({
        kind: 'action-detail',
        actionId: 12,
        inviteToken: 'tok',
        dedupeKey: 'action:12:',
      }),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 12, inviteToken: 'tok' },
    })
  })

  it('action-detail with claimReward → ActionDetail claim param', async () => {
    const { navigatePendingNotificationTarget } = await import('./navigationRef')
    expect(
      navigatePendingNotificationTarget({
        kind: 'action-detail',
        actionId: 8,
        claimReward: true,
        dedupeKey: 'action:8:1',
      }),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: 8, claimReward: true },
    })
  })

  it('returns false when navigator not ready', async () => {
    isReady.mockReturnValue(false)
    const { navigatePendingNotificationTarget } = await import('./navigationRef')
    expect(
      navigatePendingNotificationTarget({
        kind: 'notification-detail',
        notificationId: 1,
        dedupeKey: 'notif:1',
      }),
    ).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })
})
