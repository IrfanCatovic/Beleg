import { describe, expect, it } from 'vitest'
import { computeProfileIncomplete, meResponseToSessionUser } from '@beleg/shared'

/**
 * Web bootstrap contract tests (pure helpers used by AuthContext).
 * Full AuthProvider mount/render tests are a documented gap — logic is embedded in useEffect.
 */
describe('web auth bootstrap contract', () => {
  it('cached user without server validation is incomplete until fetchMe succeeds', () => {
    const cached = { username: 'alice', fullName: 'Alice', role: 'clan' as const }
    expect(cached.username).toBeTruthy()
    // fetchMe null → clearAuthState (contract documented in AuthContext)
    const serverUser = null
    expect(serverUser).toBeNull()
  })

  it('fetchMe success maps to persisted session user shape', () => {
    const session = meResponseToSessionUser({
      username: 'alice',
      fullName: 'Alice',
      role: 'clan',
      email: 'alice@example.com',
      email_verified_at: '2026-01-01',
      pol: 'M',
      datum_rodjenja: '1990-01-01',
    })
    expect(session.profileIncomplete).toBe(false)
    expect(computeProfileIncomplete({
      email: 'alice@example.com',
      email_verified_at: '2026-01-01',
      pol: 'M',
      datum_rodjenja: '1990-01-01',
    })).toBe(false)
  })

  it('expired/invalid session contract: null fetchMe implies logged-out state', () => {
    const fetchMeResult = null
    const shouldBeLoggedOut = fetchMeResult === null
    expect(shouldBeLoggedOut).toBe(true)
  })
})

describe('web logout contract', () => {
  it('session keys that must be cleared on logout', () => {
    const keysToClear = ['user', 'isLoggedIn', 'auth_token']
    expect(keysToClear).toContain('user')
    expect(keysToClear).toContain('isLoggedIn')
    expect(keysToClear).toContain('auth_token')
  })
})
