import { describe, expect, it, vi } from 'vitest'
import { createRefreshGuard, runProfilePullToRefresh } from './profileRefresh'
import {
  getClimbedEmptyCopy,
  getGuidedEmptyCopy,
  shouldShowGuidedActionsTab,
} from './profileEmptyStates'

describe('profileRefresh', () => {
  it('own refresh includes steps and settles after one failure', async () => {
    const steps = vi.fn(async () => undefined)
    const failStats = vi.fn(async () => {
      throw new Error('stats fail')
    })
    const ok = vi.fn(async () => 'ok')

    const { settled, ranSteps } = await runProfilePullToRefresh('own', {
      refetchProfile: ok,
      refetchStats: failStats,
      refetchClimbed: ok,
      refetchGuided: ok,
      refetchFollowCounts: ok,
      refreshDailySteps: steps,
    })

    expect(ranSteps).toBe(true)
    expect(steps).toHaveBeenCalledTimes(1)
    expect(settled).toHaveLength(6)
    expect(settled.some((r) => r.status === 'rejected')).toBe(true)
    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(5)
  })

  it('public refresh does not call steps', async () => {
    const steps = vi.fn(async () => undefined)
    const ok = vi.fn(async () => undefined)
    const { ranSteps } = await runProfilePullToRefresh('public', {
      refetchProfile: ok,
      refetchStats: ok,
      refetchClimbed: ok,
      refetchGuided: ok,
      refetchFollowCounts: ok,
      refetchFollowStatus: ok,
      refetchBlockStatus: ok,
      refreshDailySteps: steps,
    })
    expect(ranSteps).toBe(false)
    expect(steps).not.toHaveBeenCalled()
  })

  it('refresh guard blocks parallel duplicates and clears after settle', async () => {
    const guard = createRefreshGuard()
    let resolve!: () => void
    const slow = new Promise<void>((r) => {
      resolve = r
    })
    const first = guard.run(async () => {
      await slow
    })
    const second = await guard.run(async () => undefined)
    expect(second).toBe(false)
    expect(guard.refreshing).toBe(true)
    resolve()
    expect(await first).toBe(true)
    expect(guard.refreshing).toBe(false)
  })
})

describe('profileEmptyStates (mobile)', () => {
  it('own empty has CTA, public does not', () => {
    expect(getClimbedEmptyCopy(true).ctaLabel).toBe('Pronađi akciju')
    expect(getClimbedEmptyCopy(false).ctaLabel).toBeNull()
  })

  it('guide/non-guide tab visibility', () => {
    expect(shouldShowGuidedActionsTab({ isProfiGuide: false, guidedCount: 0 })).toBe(false)
    expect(getGuidedEmptyCopy(true).title).toContain('vođenih')
  })
})
