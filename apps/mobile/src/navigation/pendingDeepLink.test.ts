import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  clearPendingDeepLink,
  peekPendingDeepLink,
  readPendingDeepLink,
  savePendingDeepLink,
} from './pendingDeepLink'
import { PENDING_DEEP_LINK_KEY } from './parseActionDeepLink'

const VALID_URL = 'planiner://akcije/42?inviteToken=abc'

describe('pendingDeepLink savedAt', () => {
  beforeEach(() => {
    for (const key of Object.keys(mem)) delete mem[key]
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves JSON with savedAt timestamp', async () => {
    await savePendingDeepLink(VALID_URL)
    const raw = mem[PENDING_DEEP_LINK_KEY]
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.url).toBe(VALID_URL)
    expect(parsed.savedAt).toBe(Date.parse('2026-07-28T12:00:00.000Z'))
  })

  it('reads new format with savedAt', async () => {
    await savePendingDeepLink(VALID_URL)
    const record = await readPendingDeepLink()
    expect(record?.url).toBe(VALID_URL)
    expect(record?.savedAt).toBeGreaterThan(0)
  })

  it('legacy plain URL string → savedAt 0', async () => {
    mem[PENDING_DEEP_LINK_KEY] = VALID_URL
    const record = await readPendingDeepLink()
    expect(record?.url).toBe(VALID_URL)
    expect(record?.savedAt).toBe(0)
  })

  it('invalid URL is cleared on read', async () => {
    mem[PENDING_DEEP_LINK_KEY] = 'https://evil.com/foo'
    expect(await readPendingDeepLink()).toBeNull()
    expect(mem[PENDING_DEEP_LINK_KEY]).toBeUndefined()
  })

  it('corrupt JSON with invalid url clears storage', async () => {
    mem[PENDING_DEEP_LINK_KEY] = '{"url":"not-a-link","savedAt":1}'
    expect(await readPendingDeepLink()).toBeNull()
    expect(mem[PENDING_DEEP_LINK_KEY]).toBeUndefined()
  })

  it('invalid savedAt normalizes to 0', async () => {
    mem[PENDING_DEEP_LINK_KEY] = JSON.stringify({ url: VALID_URL, savedAt: 'nope' })
    const record = await readPendingDeepLink()
    expect(record?.savedAt).toBe(0)
  })

  it('peek returns url only', async () => {
    await savePendingDeepLink(VALID_URL)
    expect(await peekPendingDeepLink()).toBe(VALID_URL)
  })

  it('clear is best-effort', async () => {
    await savePendingDeepLink(VALID_URL)
    await clearPendingDeepLink()
    expect(await readPendingDeepLink()).toBeNull()
  })

  it('re-save refreshes savedAt on new user tap', async () => {
    await savePendingDeepLink(VALID_URL)
    const first = (await readPendingDeepLink())!.savedAt
    vi.setSystemTime(new Date('2026-07-28T13:00:00.000Z'))
    await savePendingDeepLink(VALID_URL)
    const second = (await readPendingDeepLink())!.savedAt
    expect(second).toBeGreaterThan(first)
  })

  it('logged-out reward URL preserves claimReward query and savedAt', async () => {
    const rewardUrl = 'planiner://akcije/42?claimReward=1&inviteToken=tok'
    await savePendingDeepLink(rewardUrl)
    const record = await readPendingDeepLink()
    expect(record?.url).toBe(rewardUrl)
    expect(record?.url).toContain('claimReward=1')
    expect(record?.url).toContain('inviteToken=tok')
    expect(record?.savedAt).toBe(Date.parse('2026-07-28T12:00:00.000Z'))
  })

  it('invalid stored reward-looking URL is cleared without crash', async () => {
    mem[PENDING_DEEP_LINK_KEY] = JSON.stringify({
      url: 'planiner://akcije/0?claimReward=1',
      savedAt: 1,
    })
    expect(await readPendingDeepLink()).toBeNull()
    expect(mem[PENDING_DEEP_LINK_KEY]).toBeUndefined()
  })
})
