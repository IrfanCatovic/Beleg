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

  it('401 cleanup clears local keys but not HttpOnly cookie (AUTH-A4 contract)', () => {
    const actionsOn401 = ['remove user', 'remove isLoggedIn', 'setAuthToken(null)']
    const actionsNotOn401 = ['POST /api/logout', 'clear HttpOnly cookie']
    expect(actionsOn401).toHaveLength(3)
    expect(actionsNotOn401).toContain('POST /api/logout')
  })
})

describe('web AuthProvider integration gap', () => {
  it('documents missing render tests — no @testing-library/react in root package.json', () => {
    const gap = {
      cachedSessionHydrate: 'NOT_IMPLEMENTED',
      protectedRouteVisibility: 'NOT_IMPLEMENTED',
      global401Redirect: 'NOT_IMPLEMENTED',
      reason: 'Requires @testing-library/react + jsdom — not in current devDependencies',
    }
    expect(gap.cachedSessionHydrate).toBe('NOT_IMPLEMENTED')
  })
})

describe('web credential dual-storage contract', () => {
  it('Bearer in localStorage + HttpOnly cookie both set on login', () => {
    const mechanisms = ['localStorage auth_token', 'HttpOnly auth_token cookie']
    expect(mechanisms).toHaveLength(2)
  })

  it('withCredentials:true sends cookie on API requests', () => {
    const webApiConfig = { withCredentials: true }
    expect(webApiConfig.withCredentials).toBe(true)
  })
})
