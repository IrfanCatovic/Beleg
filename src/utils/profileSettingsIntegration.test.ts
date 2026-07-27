import { describe, expect, it, vi } from 'vitest'
import {
  applyWebSettingsAuthRefresh,
  mergeOwnProfileFromSession,
} from './profileSettingsIntegration'
import { publicProfilePath } from './profileSettingsModel'
import { isOwnProfile } from './profileOwnership'
import { computeProfileCompletion } from './profileCompletion'

describe('profile settings → public profile integration', () => {
  it('settings success refreshes current user exactly once', async () => {
    const refreshUser = vi.fn(async () => true)
    await applyWebSettingsAuthRefresh({ refreshUser })
    await applyWebSettingsAuthRefresh({ refreshUser })
    expect(refreshUser).toHaveBeenCalledTimes(2)
    // simulate one save:
    refreshUser.mockClear()
    await applyWebSettingsAuthRefresh({ refreshUser })
    expect(refreshUser).toHaveBeenCalledTimes(1)
  })

  it('completion recalculates after success fields', () => {
    const before = computeProfileCompletion({
      fullName: 'A',
      username: 'a',
      email: 'a@b.c',
      emailVerified: true,
      hasAvatar: false,
    })
    const after = computeProfileCompletion({
      fullName: 'A',
      username: 'a',
      email: 'a@b.c',
      emailVerified: true,
      hasAvatar: true,
    })
    expect(before.percentage).toBe(80)
    expect(after.percentage).toBe(100)
  })

  it('public profile link uses new username', () => {
    expect(publicProfilePath('novi.user')).toBe('/korisnik/novi.user')
  })

  it('without username has no invalid route', () => {
    expect(publicProfilePath('')).toBeNull()
    expect(publicProfilePath(undefined)).toBeNull()
  })

  it('owner recognized via ID when available', () => {
    expect(isOwnProfile({ viewerId: 3, profileId: 3 })).toBe(true)
  })

  it('logged-out is not owner', () => {
    expect(isOwnProfile({ profileUsername: 'x', profileId: 1 })).toBe(false)
  })

  it('mergeOwnProfileFromSession updates avatar and clears to fallback when removed', () => {
    const merged = mergeOwnProfileFromSession(
      { username: 'ana', fullName: 'Ana', avatar_url: 'https://old' },
      { username: 'ana', fullName: 'Ana Nova', avatarUrl: '' },
      true,
    )
    expect(merged?.fullName).toBe('Ana Nova')
    expect(merged?.avatar_url).toBeUndefined()
  })

  it('does not merge session into public (non-own) profile', () => {
    const prev = { username: 'bob', fullName: 'Bob', avatar_url: 'https://bob' }
    expect(
      mergeOwnProfileFromSession(prev, { username: 'ana', fullName: 'Ana', avatarUrl: 'x' }, false),
    ).toBe(prev)
  })
})
