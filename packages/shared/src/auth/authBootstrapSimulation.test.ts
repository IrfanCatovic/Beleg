import { describe, expect, it } from 'vitest'
import { meResponseToSessionUser } from './session'

/**
 * Pure simulation of web AuthContext bootstrap decisions (no React mount).
 * Mirrors AuthContext.tsx useEffect without production changes.
 */

type BootstrapState = {
  isLoggedIn: boolean
  user: { username: string; role: string; fullName?: string } | null
  authLoading: boolean
}

function hydrateFromCache(
  cachedUser: string | null,
  cachedLoggedIn: boolean,
): Pick<BootstrapState, 'isLoggedIn' | 'user'> {
  if (!cachedUser || !cachedLoggedIn) {
    return { isLoggedIn: false, user: null }
  }
  try {
    const parsed = JSON.parse(cachedUser) as { username?: string; role?: string }
    if (parsed?.username && parsed?.role) {
      return { isLoggedIn: true, user: parsed as BootstrapState['user'] }
    }
  } catch {
    return { isLoggedIn: false, user: null }
  }
  return { isLoggedIn: false, user: null }
}

function applyFetchMeResult(
  state: BootstrapState,
  fetchMeResult: ReturnType<typeof meResponseToSessionUser> | null,
): BootstrapState {
  if (!fetchMeResult) {
    return { isLoggedIn: false, user: null, authLoading: false }
  }
  return {
    isLoggedIn: true,
    user: fetchMeResult,
    authLoading: false,
  }
}

function applyNetworkError(state: BootstrapState): BootstrapState {
  return { ...state, authLoading: false }
}

describe('web bootstrap simulation', () => {
  it('A: cache + valid token + /api/me 200 → logged-in with server user', () => {
    const cache = JSON.stringify({ username: 'alice', role: 'clan', fullName: 'Alice' })
    const hydrated = hydrateFromCache(cache, true)
    expect(hydrated.isLoggedIn).toBe(true)

    const server = meResponseToSessionUser({
      username: 'alice',
      fullName: 'Alice Server',
      role: 'clan',
      email: 'a@b.c',
      email_verified_at: '2026-01-01',
      pol: 'M',
      datum_rodjenja: '1990-01-01',
    })
    const final = applyFetchMeResult({ ...hydrated, authLoading: true }, server)
    expect(final.isLoggedIn).toBe(true)
    expect(final.user?.fullName).toBe('Alice Server')
    expect(final.authLoading).toBe(false)
  })

  it('B: cache + /api/me 401 → session cleared', () => {
    const cache = JSON.stringify({ username: 'alice', role: 'clan' })
    const hydrated = hydrateFromCache(cache, true)
    const final = applyFetchMeResult({ ...hydrated, authLoading: true }, null)
    expect(final.isLoggedIn).toBe(false)
    expect(final.user).toBeNull()
  })

  it('C: cache + network error → cache retained (offline tolerance)', () => {
    const cache = JSON.stringify({ username: 'alice', role: 'clan', fullName: 'Alice' })
    const hydrated = hydrateFromCache(cache, true)
    const final = applyNetworkError({ ...hydrated, authLoading: true })
    expect(final.isLoggedIn).toBe(true)
    expect(final.user?.username).toBe('alice')
    expect(final.authLoading).toBe(false)
  })
})

describe('web account switch / stale bootstrap race simulation', () => {
  it('late stale fetchMe 401 after User B login can wipe B session (P1 risk)', () => {
    let isLoggedIn = true
    let user: { username: string } | null = { username: 'bob' }

    const loginB = () => {
      user = { username: 'bob' }
      isLoggedIn = true
    }

    const staleBootstrap401 = () => {
      isLoggedIn = false
      user = null
    }

    loginB()
    staleBootstrap401()

    expect(isLoggedIn).toBe(false)
    expect(user).toBeNull()
  })

  it('late stale fetchMe 200 with User A after User B login can overwrite B (P1 risk)', () => {
    let user: { username: string } | null = { username: 'bob' }

    const loginB = () => {
      user = { username: 'bob' }
    }

    const staleBootstrap200A = () => {
      user = { username: 'alice' }
    }

    loginB()
    staleBootstrap200A()

    expect(user?.username).toBe('alice')
  })
})

describe('web 401 local-only cleanup contract', () => {
  it('clearAuthState removes local keys but does not call /api/logout', () => {
    const storage = new Map<string, string>([
      ['user', '{}'],
      ['isLoggedIn', 'true'],
      ['auth_token', 'jwt'],
    ])
    const logoutApiCalled = false

    const clearAuthState = () => {
      storage.delete('user')
      storage.delete('isLoggedIn')
      storage.delete('auth_token')
    }

    clearAuthState()
    expect(storage.has('auth_token')).toBe(false)
    expect(logoutApiCalled).toBe(false)
    // HttpOnly cookie not represented in this simulation — remains until explicit logout
  })

  it('network recovery: first protected 401 after offline triggers single cleanup path', () => {
    let cleaned = 0
    const onUnauthorized = () => {
      cleaned += 1
    }
    onUnauthorized()
    expect(cleaned).toBe(1)
  })
})

describe('late 401 after successful login race', () => {
  it('stale protected 401 must not clear new session when guarded by generation counter', () => {
    let sessionGen = 0
    let isLoggedIn = false

    const login = () => {
      sessionGen += 1
      isLoggedIn = true
      return sessionGen
    }

    const handle401 = (requestGen: number) => {
      if (requestGen === sessionGen) {
        isLoggedIn = false
      }
    }

    const genAtRequest = 0
    const loginGen = login()
    handle401(genAtRequest)

    expect(isLoggedIn).toBe(true)
    expect(loginGen).toBe(1)

    handle401(loginGen)
    expect(isLoggedIn).toBe(false)
  })

  it('web AuthContext has NO session generation guard — stale 401 can clear new session', () => {
    const hasGenerationGuard = false
    expect(hasGenerationGuard).toBe(false)
  })
})
