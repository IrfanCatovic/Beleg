import { describe, expect, it, vi } from 'vitest'
import {
  applyPushNotificationDecision,
  consumePendingNotificationAfterAuth,
} from './applyPushNotificationDecision'
import { decidePushNotificationResponse } from './decidePushNotificationResponse'
import type { PendingNotificationTarget } from './pendingNotificationTarget'

const notifTarget: PendingNotificationTarget = {
  kind: 'notification-detail',
  notificationId: 4,
  dedupeKey: 'notif:4',
}

const actionTarget: PendingNotificationTarget = {
  kind: 'action-detail',
  actionId: 20,
  dedupeKey: 'action:20:9',
}

describe('logged-out push apply', () => {
  it('foreground/background tap: saves pending, does not navigate, no success dedupe', async () => {
    const tryNavigate = vi.fn(() => true)
    const savePending = vi.fn(async () => true)
    const clearPending = vi.fn(async () => undefined)
    const onNavigated = vi.fn()

    const decision = decidePushNotificationResponse({
      isLoggedIn: false,
      pushData: { type: 'follow', obavestenjeId: 4 },
      lastSuccessfulDedupeKey: null,
    })

    const result = await applyPushNotificationDecision({
      decision,
      tryNavigate,
      savePending,
      clearPending,
      onNavigated,
    })

    expect(result).toBe('saved-pending')
    expect(savePending).toHaveBeenCalledWith(notifTarget)
    expect(tryNavigate).not.toHaveBeenCalled()
    expect(onNavigated).not.toHaveBeenCalled()
    expect(clearPending).not.toHaveBeenCalled()
  })

  it('cold-start logged-out: same save-pending path', async () => {
    const decision = decidePushNotificationResponse({
      isLoggedIn: false,
      pushData: { type: 'action_cancelled', akcijaId: 20, obavestenjeId: 9, isCancelled: true },
      lastSuccessfulDedupeKey: null,
    })
    const savePending = vi.fn(async () => true)
    const result = await applyPushNotificationDecision({
      decision,
      tryNavigate: () => true,
      savePending,
      clearPending: async () => undefined,
      onNavigated: () => undefined,
    })
    expect(result).toBe('saved-pending')
    expect(savePending).toHaveBeenCalledWith(actionTarget)
  })

  it('two taps of same notification while logged-out overwrite one pending', async () => {
    const savePending = vi.fn(async () => true)
    const decision = decidePushNotificationResponse({
      isLoggedIn: false,
      pushData: { obavestenjeId: 4 },
      lastSuccessfulDedupeKey: null,
    })
    await applyPushNotificationDecision({
      decision,
      tryNavigate: () => true,
      savePending,
      clearPending: async () => undefined,
      onNavigated: () => undefined,
    })
    await applyPushNotificationDecision({
      decision,
      tryNavigate: () => true,
      savePending,
      clearPending: async () => undefined,
      onNavigated: () => undefined,
    })
    expect(savePending).toHaveBeenCalledTimes(2)
    expect(savePending).toHaveBeenNthCalledWith(1, notifTarget)
    expect(savePending).toHaveBeenNthCalledWith(2, notifTarget)
  })

  it('logged-out does not skip-duplicate even if prior success key matches', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: false,
        pushData: { obavestenjeId: 4 },
        lastSuccessfulDedupeKey: 'notif:4',
      }).action,
    ).toBe('save-pending')
  })
})

describe('logged-in apply', () => {
  it('action_cancelled navigates ActionDetail and sets success dedupe', async () => {
    const onNavigated = vi.fn()
    const clearPending = vi.fn(async () => undefined)
    const decision = decidePushNotificationResponse({
      isLoggedIn: true,
      pushData: {
        type: 'action_cancelled',
        akcijaId: 20,
        obavestenjeId: 9,
        isCancelled: true,
      },
      lastSuccessfulDedupeKey: null,
    })
    const result = await applyPushNotificationDecision({
      decision,
      tryNavigate: () => true,
      savePending: async () => true,
      clearPending,
      onNavigated,
    })
    expect(result).toBe('navigated')
    expect(onNavigated).toHaveBeenCalledWith('action:20:9')
    expect(clearPending).toHaveBeenCalled()
  })

  it('ordinary notification navigates NotificationDetail', async () => {
    const onNavigated = vi.fn()
    const decision = decidePushNotificationResponse({
      isLoggedIn: true,
      pushData: { type: 'follow', obavestenjeId: 4 },
      lastSuccessfulDedupeKey: null,
    })
    await applyPushNotificationDecision({
      decision,
      tryNavigate: () => true,
      savePending: async () => true,
      clearPending: async () => undefined,
      onNavigated,
    })
    expect(onNavigated).toHaveBeenCalledWith('notif:4')
  })

  it('nav not ready → deferred pending, no success dedupe', async () => {
    const onNavigated = vi.fn()
    const savePending = vi.fn(async () => true)
    const decision = decidePushNotificationResponse({
      isLoggedIn: true,
      pushData: { obavestenjeId: 4 },
      lastSuccessfulDedupeKey: null,
    })
    const result = await applyPushNotificationDecision({
      decision,
      tryNavigate: () => false,
      savePending,
      clearPending: async () => undefined,
      onNavigated,
    })
    expect(result).toBe('deferred-pending')
    expect(savePending).toHaveBeenCalledWith(notifTarget)
    expect(onNavigated).not.toHaveBeenCalled()
  })

  it('navigation throw → deferred pending, no success dedupe', async () => {
    const onNavigated = vi.fn()
    const savePending = vi.fn(async () => true)
    const decision = decidePushNotificationResponse({
      isLoggedIn: true,
      pushData: { obavestenjeId: 4 },
      lastSuccessfulDedupeKey: null,
    })
    const result = await applyPushNotificationDecision({
      decision,
      tryNavigate: () => {
        throw new Error('nav boom')
      },
      savePending,
      clearPending: async () => undefined,
      onNavigated,
    })
    expect(result).toBe('deferred-pending')
    expect(onNavigated).not.toHaveBeenCalled()
    expect(savePending).toHaveBeenCalled()
  })

  it('duplicate listener/cold-start after success is noop', async () => {
    const tryNavigate = vi.fn(() => true)
    const decision = decidePushNotificationResponse({
      isLoggedIn: true,
      pushData: { obavestenjeId: 4 },
      lastSuccessfulDedupeKey: 'notif:4',
    })
    const result = await applyPushNotificationDecision({
      decision,
      tryNavigate,
      savePending: async () => true,
      clearPending: async () => undefined,
      onNavigated: () => undefined,
    })
    expect(result).toBe('noop')
    expect(tryNavigate).not.toHaveBeenCalled()
  })
})

describe('consume pending after auth', () => {
  it('login + navigation ready: navigates once, clears pending, sets dedupe', async () => {
    let stored: PendingNotificationTarget | null = { ...notifTarget }
    const onNavigated = vi.fn()
    const tryNavigate = vi.fn(() => true)

    const result = await consumePendingNotificationAfterAuth({
      readPending: async () => stored,
      clearPending: async () => {
        stored = null
      },
      tryNavigate,
      lastSuccessfulDedupeKey: null,
      onNavigated,
    })

    expect(result).toBe('navigated')
    expect(tryNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigated).toHaveBeenCalledWith('notif:4')
    expect(stored).toBeNull()
  })

  it('login, navigation not ready: pending remains, no dedupe', async () => {
    let stored: PendingNotificationTarget | null = { ...notifTarget }
    const onNavigated = vi.fn()

    const result = await consumePendingNotificationAfterAuth({
      readPending: async () => stored,
      clearPending: async () => {
        stored = null
      },
      tryNavigate: () => false,
      lastSuccessfulDedupeKey: null,
      onNavigated,
    })

    expect(result).toBe('not-ready')
    expect(stored).toEqual(notifTarget)
    expect(onNavigated).not.toHaveBeenCalled()
  })

  it('later ready event navigates once', async () => {
    let stored: PendingNotificationTarget | null = { ...notifTarget }
    let ready = false
    const onNavigated = vi.fn()

    expect(
      await consumePendingNotificationAfterAuth({
        readPending: async () => stored,
        clearPending: async () => {
          stored = null
        },
        tryNavigate: () => ready,
        lastSuccessfulDedupeKey: null,
        onNavigated,
      }),
    ).toBe('not-ready')

    ready = true
    expect(
      await consumePendingNotificationAfterAuth({
        readPending: async () => stored,
        clearPending: async () => {
          stored = null
        },
        tryNavigate: () => ready,
        lastSuccessfulDedupeKey: null,
        onNavigated,
      }),
    ).toBe('navigated')

    expect(onNavigated).toHaveBeenCalledTimes(1)
    expect(stored).toBeNull()
  })

  it('navigation failure leaves pending and no success dedupe', async () => {
    let stored: PendingNotificationTarget | null = { ...actionTarget }
    const onNavigated = vi.fn()

    const result = await consumePendingNotificationAfterAuth({
      readPending: async () => stored,
      clearPending: async () => {
        stored = null
      },
      tryNavigate: () => {
        throw new Error('fail')
      },
      lastSuccessfulDedupeKey: null,
      onNavigated,
    })

    expect(result).toBe('navigate-failed')
    expect(stored).toEqual(actionTarget)
    expect(onNavigated).not.toHaveBeenCalled()
  })

  it('explicit logout cleanup then new push can be saved again', async () => {
    let stored: PendingNotificationTarget | null = { ...notifTarget }
    await consumePendingNotificationAfterAuth({
      readPending: async () => stored,
      clearPending: async () => {
        stored = null
      },
      tryNavigate: () => true,
      lastSuccessfulDedupeKey: null,
      onNavigated: () => undefined,
    })
    expect(stored).toBeNull()

    // simulate logout clear + new logged-out save
    stored = null
    const decision = decidePushNotificationResponse({
      isLoggedIn: false,
      pushData: { obavestenjeId: 99 },
      lastSuccessfulDedupeKey: null,
    })
    await applyPushNotificationDecision({
      decision,
      tryNavigate: () => true,
      savePending: async (t) => {
        stored = t
        return true
      },
      clearPending: async () => {
        stored = null
      },
      onNavigated: () => undefined,
    })
    expect(stored).toEqual({
      kind: 'notification-detail',
      notificationId: 99,
      dedupeKey: 'notif:99',
    })
  })
})
