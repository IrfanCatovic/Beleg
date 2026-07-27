import { describe, expect, it, vi } from 'vitest'
import { isOwnProfile } from './profileOwnership'
import { invalidateOwnProfileAfterSettingsSave, profileKeys } from './profileKeys'
import { createRefreshGuard, runProfilePullToRefresh } from './profileRefresh'

describe('Faza E mobile profile integration', () => {
  it('settings success invalidates own profile key without duplicate detail invalidate', async () => {
    const invalidateQueries = vi.fn(async () => undefined)
    const result = await invalidateOwnProfileAfterSettingsSave(
      { invalidateQueries },
      { previousUsername: 'ana', nextUsername: 'ana', invalidateMeProfile: true },
    )
    expect(result.invalidated.filter((x) => x.startsWith('detail:'))).toHaveLength(1)
    expect(result.invalidated).toContain('me-profile')
  })

  it('public A and B use distinct detail keys', () => {
    expect(profileKeys.detail('a')).not.toEqual(profileKeys.detail('b'))
  })

  it('username change uses new query key', () => {
    expect(profileKeys.detail('old')).toEqual(['korisnik', 'old'])
    expect(profileKeys.detail('new')).toEqual(['korisnik', 'new'])
  })

  it('pull-to-refresh public does not include steps', async () => {
    const steps = vi.fn(async () => undefined)
    const { ranSteps } = await runProfilePullToRefresh('public', {
      refetchProfile: async () => undefined,
      refetchStats: async () => undefined,
      refetchClimbed: async () => undefined,
      refetchGuided: async () => undefined,
      refreshDailySteps: steps,
    })
    expect(ranSteps).toBe(false)
    expect(steps).not.toHaveBeenCalled()
  })

  it('owner via ID when available', () => {
    expect(isOwnProfile({ viewerId: 2, profileId: 2, viewerUsername: 'x' })).toBe(true)
  })

  it('logged-out has no owner controls', () => {
    expect(isOwnProfile({ profileId: 1, profileUsername: 'ana' })).toBe(false)
  })

  it('refresh guard blocks parallel double refresh', async () => {
    const guard = createRefreshGuard()
    let runs = 0
    const job = async () => {
      runs += 1
      await new Promise((r) => setTimeout(r, 20))
    }
    const a = guard.run(job)
    const b = guard.run(job)
    await Promise.all([a, b])
    expect(runs).toBe(1)
  })

  it('canonical pull-to-refresh keys stay profileKeys-shaped', () => {
    const u = 'ana'
    expect(profileKeys.stats(u)[2]).toBe('statistika')
    expect(profileKeys.climbed(u)[2]).toBe('popeo-se')
    expect(profileKeys.guided(u)[2]).toBe('vodio')
  })
})
