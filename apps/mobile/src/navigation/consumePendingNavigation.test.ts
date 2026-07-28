import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingNavigationOnSessionEnd,
  consumePendingNavigation,
  resetPendingNavigationConsumeState,
  type ConsumePendingNavigationOpts,
} from './consumePendingNavigation'
import type { PendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'

const pushTarget: PendingNotificationTarget = {
  kind: 'notification-detail',
  notificationId: 4,
  dedupeKey: 'notif:4',
  savedAt: 200,
}

function baseOpts(
  overrides: Partial<ConsumePendingNavigationOpts> = {},
): ConsumePendingNavigationOpts {
  return {
    isLoggedIn: true,
    authLoading: false,
    isNavigationReady: true,
    sessionConsumed: false,
    readUrlPending: async () => null,
    readPushPending: async () => null,
    clearUrlPending: async () => undefined,
    clearPushPending: async () => undefined,
    tryNavigateUrl: () => true,
    tryNavigatePush: () => true,
    lastSuccessfulPushDedupeKey: null,
    onPushNavigated: () => undefined,
    ...overrides,
  }
}

describe('consumePendingNavigation', () => {
  beforeEach(() => {
    resetPendingNavigationConsumeState()
  })

  it('auth not ready → not-ready', async () => {
    expect(
      await consumePendingNavigation(
        baseOpts({ authLoading: true, readPushPending: async () => pushTarget }),
      ),
    ).toBe('not-ready')
  })

  it('logged-out → not-ready, pending untouched', async () => {
    let stored: PendingNotificationTarget | null = pushTarget
    const result = await consumePendingNavigation(
      baseOpts({
        isLoggedIn: false,
        readPushPending: async () => stored,
        clearPushPending: async () => {
          stored = null
        },
      }),
    )
    expect(result).toBe('not-ready')
    expect(stored).toEqual(pushTarget)
  })

  it('navigation not ready → not-ready', async () => {
    expect(
      await consumePendingNavigation(
        baseOpts({ isNavigationReady: false, readPushPending: async () => pushTarget }),
      ),
    ).toBe('not-ready')
  })

  it('onReady after auth → navigates once', async () => {
    let ready = false
    const tryNavigatePush = vi.fn(() => ready)
    const onPushNavigated = vi.fn()
    let stored: PendingNotificationTarget | null = pushTarget

    expect(
      await consumePendingNavigation(
        baseOpts({
          isNavigationReady: false,
          readPushPending: async () => stored,
          clearPushPending: async () => {
            stored = null
          },
          tryNavigatePush,
          onPushNavigated,
        }),
      ),
    ).toBe('not-ready')

    ready = true
    expect(
      await consumePendingNavigation(
        baseOpts({
          readPushPending: async () => stored,
          clearPushPending: async () => {
            stored = null
          },
          tryNavigatePush,
          onPushNavigated,
        }),
      ),
    ).toBe('navigated')

    expect(tryNavigatePush).toHaveBeenCalledTimes(1)
    expect(onPushNavigated).toHaveBeenCalledWith('notif:4')
    expect(stored).toBeNull()
  })

  it('auth effect and onReady concurrent → single navigation (single-flight)', async () => {
    const tryNavigatePush = vi.fn(() => true)
    let readCount = 0
    const readPushPending = vi.fn(async () => {
      readCount++
      await new Promise((r) => setTimeout(r, 5))
      return pushTarget
    })

    const p1 = consumePendingNavigation(
      baseOpts({ readPushPending, tryNavigatePush }),
    )
    const p2 = consumePendingNavigation(
      baseOpts({ readPushPending, tryNavigatePush }),
    )
    const [r1, r2] = await Promise.all([p1, p2])
    expect([r1, r2]).toContain('navigated')
    expect(readCount).toBe(1)
    expect(tryNavigatePush).toHaveBeenCalledTimes(1)
  })

  it('newer URL → only URL navigation', async () => {
    const tryNavigateUrl = vi.fn(() => true)
    const tryNavigatePush = vi.fn(() => true)
    await consumePendingNavigation(
      baseOpts({
        readUrlPending: async () => ({
          url: 'planiner://akcije/10',
          savedAt: 300,
        }),
        readPushPending: async () => ({ ...pushTarget, savedAt: 100 }),
        tryNavigateUrl,
        tryNavigatePush,
      }),
    )
    expect(tryNavigateUrl).toHaveBeenCalledTimes(1)
    expect(tryNavigatePush).not.toHaveBeenCalled()
  })

  it('newer push → push navigation + success dedupe', async () => {
    const onPushNavigated = vi.fn()
    const tryNavigatePush = vi.fn(() => true)
    await consumePendingNavigation(
      baseOpts({
        readUrlPending: async () => ({
          url: 'planiner://akcije/10',
          savedAt: 100,
        }),
        readPushPending: async () => ({ ...pushTarget, savedAt: 300 }),
        tryNavigatePush,
        onPushNavigated,
      }),
    )
    expect(tryNavigatePush).toHaveBeenCalledTimes(1)
    expect(onPushNavigated).toHaveBeenCalledWith('notif:4')
  })

  it('superseded push cleared without success dedupe when URL wins', async () => {
    const onPushNavigated = vi.fn()
    let urlCleared = false
    let pushCleared = false
    await consumePendingNavigation(
      baseOpts({
        readUrlPending: async () => ({ url: 'planiner://akcije/10', savedAt: 500 }),
        readPushPending: async () => ({ ...pushTarget, savedAt: 100 }),
        clearUrlPending: async () => {
          urlCleared = true
        },
        clearPushPending: async () => {
          pushCleared = true
        },
        onPushNavigated,
      }),
    )
    expect(urlCleared).toBe(true)
    expect(pushCleared).toBe(true)
    expect(onPushNavigated).not.toHaveBeenCalled()
  })

  it('navigation failure → both valid records remain', async () => {
    let urlStored = { url: 'planiner://akcije/10', savedAt: 500 }
    let pushStored = { ...pushTarget, savedAt: 100 }
    const result = await consumePendingNavigation(
      baseOpts({
        readUrlPending: async () => urlStored,
        readPushPending: async () => pushStored,
        clearUrlPending: async () => {
          urlStored = null as unknown as typeof urlStored
        },
        clearPushPending: async () => {
          pushStored = null as unknown as typeof pushStored
        },
        tryNavigateUrl: () => false,
      }),
    )
    expect(result).toBe('navigate-failed')
    expect(urlStored).toBeTruthy()
    expect(pushStored).toBeTruthy()
  })

  it('storage read failure → no crash, no clear', async () => {
    const clearUrl = vi.fn()
    const clearPush = vi.fn()
    const result = await consumePendingNavigation(
      baseOpts({
        readUrlPending: async () => {
          throw new Error('read fail')
        },
        clearUrlPending: clearUrl,
        clearPushPending: clearPush,
      }),
    )
    expect(result).toBe('navigate-failed')
    expect(clearUrl).not.toHaveBeenCalled()
    expect(clearPush).not.toHaveBeenCalled()
  })

  it('clear failure after success does not navigate again in same session', async () => {
    const tryNavigatePush = vi.fn(() => true)
    let sessionConsumed = false
    const first = await consumePendingNavigation(
      baseOpts({
        readPushPending: async () => pushTarget,
        tryNavigatePush,
        clearPushPending: async () => {
          throw new Error('clear fail')
        },
        onSessionConsumed: () => {
          sessionConsumed = true
        },
      }),
    )
    expect(first).toBe('navigated')
    expect(sessionConsumed).toBe(true)

    const second = await consumePendingNavigation(
      baseOpts({
        sessionConsumed: true,
        readPushPending: async () => pushTarget,
        tryNavigatePush,
      }),
    )
    expect(second).toBe('already-consumed')
    expect(tryNavigatePush).toHaveBeenCalledTimes(1)
  })

  it('second readiness event after success does not navigate again', async () => {
    const tryNavigatePush = vi.fn(() => true)
    let sessionConsumed = false
    await consumePendingNavigation(
      baseOpts({
        readPushPending: async () => pushTarget,
        tryNavigatePush,
        onSessionConsumed: () => {
          sessionConsumed = true
        },
      }),
    )
    const again = await consumePendingNavigation(
      baseOpts({
        sessionConsumed,
        readPushPending: async () => pushTarget,
        tryNavigatePush,
      }),
    )
    expect(again).toBe('already-consumed')
    expect(tryNavigatePush).toHaveBeenCalledTimes(1)
  })

  it('single-flight resets after failure for retry', async () => {
    const tryNavigatePush = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    let stored: PendingNotificationTarget | null = pushTarget

    expect(
      await consumePendingNavigation(
        baseOpts({
          readPushPending: async () => stored,
          clearPushPending: async () => {
            stored = null
          },
          tryNavigatePush,
        }),
      ),
    ).toBe('navigate-failed')

    expect(
      await consumePendingNavigation(
        baseOpts({
          readPushPending: async () => stored,
          clearPushPending: async () => {
            stored = null
          },
          tryNavigatePush,
        }),
      ),
    ).toBe('navigated')

    expect(tryNavigatePush).toHaveBeenCalledTimes(2)
  })
})

describe('clearPendingNavigationOnSessionEnd', () => {
  beforeEach(() => {
    resetPendingNavigationConsumeState()
  })

  it('clears coordinator in-flight guard', async () => {
    let resolveRead: (() => void) | undefined
    const readPushPending = () =>
      new Promise<PendingNotificationTarget | null>((resolve) => {
        resolveRead = () => resolve(pushTarget)
      })

    const inFlight = consumePendingNavigation(baseOpts({ readPushPending }))
    await clearPendingNavigationOnSessionEnd()
    resolveRead?.()
    await inFlight
    // no throw — guard was reset
  })
})
