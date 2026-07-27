import { describe, expect, it } from 'vitest'
import { isOwnProfile } from './profileOwnership'

describe('isOwnProfile', () => {
  it('uses ID when both IDs are available', () => {
    expect(
      isOwnProfile({
        viewerId: 1,
        profileId: 1,
        viewerUsername: 'old',
        profileUsername: 'new',
      }),
    ).toBe(true)
    expect(
      isOwnProfile({
        viewerId: 1,
        profileId: 2,
        viewerUsername: 'same',
        profileUsername: 'same',
      }),
    ).toBe(false)
  })

  it('falls back to username when IDs missing', () => {
    expect(
      isOwnProfile({
        viewerUsername: 'Ana',
        profileUsername: 'ana',
      }),
    ).toBe(true)
  })

  it('logged-out is never owner', () => {
    expect(isOwnProfile({ profileId: 1, profileUsername: 'ana' })).toBe(false)
    expect(isOwnProfile({})).toBe(false)
  })

  it('rejects empty or invalid identifiers', () => {
    expect(isOwnProfile({ viewerUsername: '  ', profileUsername: 'ana' })).toBe(false)
    expect(isOwnProfile({ viewerId: 0, profileId: 0, viewerUsername: 'a', profileUsername: 'a' })).toBe(
      true,
    ) // 0 is invalid → username fallback
    expect(isOwnProfile({ viewerId: NaN as never, profileId: 1 })).toBe(false)
  })
})
