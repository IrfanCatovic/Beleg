import { describe, expect, it, vi } from 'vitest'
import { invalidateOwnProfileAfterSettingsSave, profileKeys } from './profileKeys'

describe('profileKeys', () => {
  it('builds stable detail/stats/climbed/guided keys', () => {
    expect(profileKeys.detail('ana')).toEqual(['korisnik', 'ana'])
    expect(profileKeys.stats('ana')).toEqual(['korisnik', 'ana', 'statistika'])
    expect(profileKeys.climbed('ana')).toEqual(['korisnik', 'ana', 'popeo-se'])
    expect(profileKeys.guided('ana')).toEqual(['korisnik', 'ana', 'vodio'])
  })

  it('username change invalidates old and new detail keys once each', async () => {
    const invalidateQueries = vi.fn(async () => undefined)
    const result = await invalidateOwnProfileAfterSettingsSave(
      { invalidateQueries },
      { previousUsername: 'old', nextUsername: 'new', invalidateMeProfile: true },
    )
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileKeys.detail('new') })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileKeys.detail('old') })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileKeys.me() })
    expect(result.invalidated.filter((x) => x.startsWith('detail:'))).toHaveLength(2)
    expect(result.invalidated.filter((x) => x === 'me-profile')).toHaveLength(1)
  })

  it('same username does not double-invalidate detail', async () => {
    const invalidateQueries = vi.fn(async (_opts: { queryKey: readonly unknown[] }) => undefined)
    await invalidateOwnProfileAfterSettingsSave(
      { invalidateQueries },
      { previousUsername: 'Ana', nextUsername: 'ana', invalidateMeProfile: false },
    )
    const detailCalls = invalidateQueries.mock.calls.filter((c) => {
      const key = c[0]?.queryKey
      return Array.isArray(key) && key[0] === 'korisnik'
    })
    expect(detailCalls).toHaveLength(1)
  })

  it('does not invalidate guide by default', async () => {
    const invalidateQueries = vi.fn(async () => undefined)
    await invalidateOwnProfileAfterSettingsSave(
      { invalidateQueries },
      { nextUsername: 'ana', invalidateMeProfile: false },
    )
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: profileKeys.myGuide() })
  })
})
