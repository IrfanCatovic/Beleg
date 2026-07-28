import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem: Record<string, string> = {}

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mem[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mem[key] = value
    }),
    removeItem: vi.fn(async (key: string) => {
      delete mem[key]
    }),
  },
}))

import {
  buildPendingNotificationTarget,
  PENDING_NOTIFICATION_TARGET_KEY,
  savePendingNotificationTarget,
} from '../features/notifications/pendingNotificationTarget'
import {
  consumePendingNavigation,
  clearPendingNavigationOnSessionEnd,
  resetPendingNavigationConsumeState,
} from './consumePendingNavigation'
import { PENDING_DEEP_LINK_KEY } from './parseActionDeepLink'
import { readPendingDeepLink, savePendingDeepLink } from './pendingDeepLink'
import { readPendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'

const VALID_URL = 'planiner://akcije/42'

describe('pending navigation logout cleanup', () => {
  beforeEach(() => {
    for (const key of Object.keys(mem)) delete mem[key]
    resetPendingNavigationConsumeState()
  })

  it('explicit session end clears URL + push pending', async () => {
    await savePendingDeepLink(VALID_URL)
    const push = buildPendingNotificationTarget({ obavestenjeId: 9 })!
    await savePendingNotificationTarget(push)
    expect(mem[PENDING_DEEP_LINK_KEY]).toBeTruthy()
    expect(mem[PENDING_NOTIFICATION_TARGET_KEY]).toBeTruthy()

    await clearPendingNavigationOnSessionEnd()

    expect(mem[PENDING_DEEP_LINK_KEY]).toBeUndefined()
    expect(mem[PENDING_NOTIFICATION_TARGET_KEY]).toBeUndefined()
  })

  it('after session end new push can be saved', async () => {
    await clearPendingNavigationOnSessionEnd()
    const push = buildPendingNotificationTarget({ obavestenjeId: 11 })!
    expect(await savePendingNotificationTarget(push)).toBe(true)
    expect(mem[PENDING_NOTIFICATION_TARGET_KEY]).toBeTruthy()
  })

  it('after session end new URL can be saved', async () => {
    await clearPendingNavigationOnSessionEnd()
    await savePendingDeepLink(VALID_URL)
    expect(mem[PENDING_DEEP_LINK_KEY]).toBeTruthy()
  })
})

describe('cold-start priority scenarios', () => {
  beforeEach(() => {
    for (const key of Object.keys(mem)) delete mem[key]
    resetPendingNavigationConsumeState()
  })

  it('newer push after older URL → push navigates, URL cleared', async () => {
    mem[PENDING_DEEP_LINK_KEY] = JSON.stringify({ url: VALID_URL, savedAt: 100 })
    mem[PENDING_NOTIFICATION_TARGET_KEY] = JSON.stringify({
      kind: 'notification-detail',
      notificationId: 4,
      dedupeKey: 'notif:4',
      savedAt: 200,
    })

    const tryNavigateUrl = vi.fn(() => true)
    const tryNavigatePush = vi.fn(() => true)
    const onPushNavigated = vi.fn()

    await consumePendingNavigation({
      isLoggedIn: true,
      authLoading: false,
      isNavigationReady: true,
      sessionConsumed: false,
      readUrlPending: readPendingDeepLink,
      readPushPending: readPendingNotificationTarget,
      clearUrlPending: async () => {
        delete mem[PENDING_DEEP_LINK_KEY]
      },
      clearPushPending: async () => {
        delete mem[PENDING_NOTIFICATION_TARGET_KEY]
      },
      tryNavigateUrl,
      tryNavigatePush,
      lastSuccessfulPushDedupeKey: null,
      onPushNavigated,
    })

    expect(tryNavigatePush).toHaveBeenCalledTimes(1)
    expect(tryNavigateUrl).not.toHaveBeenCalled()
    expect(onPushNavigated).toHaveBeenCalledWith('notif:4')
    expect(mem[PENDING_DEEP_LINK_KEY]).toBeUndefined()
    expect(mem[PENDING_NOTIFICATION_TARGET_KEY]).toBeUndefined()
  })

  it('newer URL after older push → URL navigates, push cleared without dedupe', async () => {
    mem[PENDING_DEEP_LINK_KEY] = JSON.stringify({ url: VALID_URL, savedAt: 300 })
    mem[PENDING_NOTIFICATION_TARGET_KEY] = JSON.stringify({
      kind: 'notification-detail',
      notificationId: 4,
      dedupeKey: 'notif:4',
      savedAt: 100,
    })

    const tryNavigateUrl = vi.fn(() => true)
    const tryNavigatePush = vi.fn(() => true)
    const onPushNavigated = vi.fn()

    await consumePendingNavigation({
      isLoggedIn: true,
      authLoading: false,
      isNavigationReady: true,
      sessionConsumed: false,
      readUrlPending: readPendingDeepLink,
      readPushPending: readPendingNotificationTarget,
      clearUrlPending: async () => {
        delete mem[PENDING_DEEP_LINK_KEY]
      },
      clearPushPending: async () => {
        delete mem[PENDING_NOTIFICATION_TARGET_KEY]
      },
      tryNavigateUrl,
      tryNavigatePush,
      lastSuccessfulPushDedupeKey: null,
      onPushNavigated,
    })

    expect(tryNavigateUrl).toHaveBeenCalledTimes(1)
    expect(tryNavigatePush).not.toHaveBeenCalled()
    expect(onPushNavigated).not.toHaveBeenCalled()
    expect(mem[PENDING_DEEP_LINK_KEY]).toBeUndefined()
    expect(mem[PENDING_NOTIFICATION_TARGET_KEY]).toBeUndefined()
  })
})
