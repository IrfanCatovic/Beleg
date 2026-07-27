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

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  PENDING_NOTIFICATION_TARGET_KEY,
  buildPendingNotificationTarget,
  clearPendingNotificationTarget,
  consumePendingNotificationTarget,
  isValidPendingNotificationTarget,
  readPendingNotificationTarget,
  savePendingNotificationTarget,
} from './pendingNotificationTarget'

describe('buildPendingNotificationTarget', () => {
  it('cancelled action → action-detail', () => {
    expect(
      buildPendingNotificationTarget({
        type: 'action_cancelled',
        akcijaId: 15,
        obavestenjeId: 99,
        isCancelled: true,
      }),
    ).toEqual({
      kind: 'action-detail',
      actionId: 15,
      dedupeKey: 'action:15:99',
    })
  })

  it('ordinary payload with obavestenjeId → notification-detail', () => {
    expect(
      buildPendingNotificationTarget({
        type: 'follow',
        obavestenjeId: 4,
      }),
    ).toEqual({
      kind: 'notification-detail',
      notificationId: 4,
      dedupeKey: 'notif:4',
    })
  })

  it('normalizes string numeric ids', () => {
    expect(
      buildPendingNotificationTarget({
        type: 'action_cancelled',
        akcijaId: '42',
        obavestenjeId: '3',
        isCancelled: 'true',
      }),
    ).toEqual({
      kind: 'action-detail',
      actionId: 42,
      dedupeKey: 'action:42:3',
    })
  })

  it('rejects 0, negative, NaN, empty', () => {
    expect(buildPendingNotificationTarget({ obavestenjeId: 0 })).toBeNull()
    expect(buildPendingNotificationTarget({ obavestenjeId: -1 })).toBeNull()
    expect(buildPendingNotificationTarget({ obavestenjeId: Number.NaN })).toBeNull()
    expect(buildPendingNotificationTarget({ obavestenjeId: '' })).toBeNull()
    expect(buildPendingNotificationTarget({})).toBeNull()
    expect(buildPendingNotificationTarget(null)).toBeNull()
  })

  it('does not invent destination from missing ids', () => {
    expect(
      buildPendingNotificationTarget({
        type: 'action_cancelled',
        isCancelled: true,
      }),
    ).toBeNull()
  })
})

describe('pendingNotificationTarget storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(mem)) delete mem[key]
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => mem[key] ?? null)
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      mem[key] = value
    })
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      delete mem[key]
    })
  })

  it('serializes and reloads a valid target without raw payload/token', async () => {
    const target = buildPendingNotificationTarget({
      type: 'uplata',
      obavestenjeId: 7,
    })
    expect(target).not.toBeNull()
    expect(await savePendingNotificationTarget(target!)).toBe(true)
    const loaded = await readPendingNotificationTarget()
    expect(loaded).toEqual(target)
    const raw = await AsyncStorage.getItem(PENDING_NOTIFICATION_TARGET_KEY)
    expect(raw).not.toContain('token')
    expect(raw).not.toContain('"body"')
    expect(raw).not.toContain('ExponentPushToken')
  })

  it('clears corrupted JSON', async () => {
    mem[PENDING_NOTIFICATION_TARGET_KEY] = '{not-json'
    expect(await readPendingNotificationTarget()).toBeNull()
    expect(mem[PENDING_NOTIFICATION_TARGET_KEY]).toBeUndefined()
  })

  it('rejects unknown kind', async () => {
    mem[PENDING_NOTIFICATION_TARGET_KEY] = JSON.stringify({
      kind: 'mystery',
      dedupeKey: 'x',
      notificationId: 1,
    })
    expect(await readPendingNotificationTarget()).toBeNull()
    expect(isValidPendingNotificationTarget({ kind: 'mystery', dedupeKey: 'x' })).toBe(false)
  })

  it('storage set failure does not throw', async () => {
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'))
    const target = buildPendingNotificationTarget({ obavestenjeId: 1 })!
    await expect(savePendingNotificationTarget(target)).resolves.toBe(false)
  })

  it('storage get failure returns null', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read fail'))
    await expect(readPendingNotificationTarget()).resolves.toBeNull()
  })

  it('consume reads and clears', async () => {
    const target = buildPendingNotificationTarget({ obavestenjeId: 11 })!
    await savePendingNotificationTarget(target)
    expect(await consumePendingNotificationTarget()).toEqual(target)
    expect(await readPendingNotificationTarget()).toBeNull()
  })

  it('clear is best-effort', async () => {
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('remove fail'))
    await expect(clearPendingNotificationTarget()).resolves.toBeUndefined()
  })

  it('two saves of same notification overwrite with one pending', async () => {
    const a = buildPendingNotificationTarget({ obavestenjeId: 5 })!
    const b = buildPendingNotificationTarget({ obavestenjeId: 5 })!
    await savePendingNotificationTarget(a)
    await savePendingNotificationTarget(b)
    expect(await readPendingNotificationTarget()).toEqual(b)
  })
})
