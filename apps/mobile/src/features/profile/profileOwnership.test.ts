import { describe, expect, it } from 'vitest'
import { isOwnProfile } from './profileOwnership'

describe('isOwnProfile (mobile)', () => {
  it('prefers ID over username', () => {
    expect(
      isOwnProfile({
        viewerId: 9,
        profileId: 9,
        viewerUsername: 'a',
        profileUsername: 'b',
      }),
    ).toBe(true)
  })

  it('logged-out is never owner', () => {
    expect(isOwnProfile({ profileUsername: 'ana', profileId: 1 })).toBe(false)
  })

  it('username fallback is case-insensitive', () => {
    expect(isOwnProfile({ viewerUsername: 'Ana', profileUsername: 'ana' })).toBe(true)
  })
})
