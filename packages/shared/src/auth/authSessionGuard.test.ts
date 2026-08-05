import { describe, expect, it, beforeEach } from 'vitest'
import { createSessionGeneration } from './sessionGeneration'
import { meResponseToSessionUser } from './session'

/**
 * Pure simulations of web/mobile auth session guard semantics (AUTH-F2).
 * Mirrors AuthContext decisions without React mount.
 */

type AuthSnapshot = {
  isLoggedIn: boolean
  user: { username: string; role: string; fullName?: string } | null
  authLoading: boolean
}

function createAuthSimulator() {
  const sessionGen = createSessionGeneration()
  let state: AuthSnapshot = { isLoggedIn: false, user: null, authLoading: true }

  return {
    sessionGen,
    getState: () => state,
    hydrate(username: string) {
      state = {
        isLoggedIn: true,
        user: { username, role: 'clan', fullName: username },
        authLoading: true,
      }
    },
    login(username: string) {
      sessionGen.advanceSessionGeneration()
      state = {
        isLoggedIn: true,
        user: { username, role: 'clan', fullName: username },
        authLoading: false,
      }
    },
    logout() {
      sessionGen.advanceSessionGeneration()
      state = { isLoggedIn: false, user: null, authLoading: false }
    },
    invalidateSession() {
      sessionGen.advanceSessionGeneration()
      state = { isLoggedIn: false, user: null, authLoading: state.authLoading }
    },
    applyBootstrapFetchMe(
      bootstrapGen: number,
      result: 'success' | '401' | 'network',
      username = 'alice',
    ) {
      if (!sessionGen.isCurrentSessionGeneration(bootstrapGen)) return
      if (result === '401') {
        sessionGen.advanceSessionGeneration()
        state = { isLoggedIn: false, user: null, authLoading: false }
        return
      }
      if (result === 'network') {
        state = { ...state, authLoading: false }
        return
      }
      const userData = meResponseToSessionUser({
        username,
        fullName: username,
        role: 'clan',
        email: 'a@b.c',
        email_verified_at: '2026-01-01',
        pol: 'M',
        datum_rodjenja: '1990-01-01',
      })
      state = { isLoggedIn: true, user: userData, authLoading: false }
    },
    finishBootstrapLoading(bootstrapGen: number) {
      if (sessionGen.isCurrentSessionGeneration(bootstrapGen)) {
        state = { ...state, authLoading: false }
      }
    },
    handleUnauthorized(requestGen: number, cleanup: () => void) {
      if (!sessionGen.isCurrentSessionGeneration(requestGen)) return
      if (!sessionGen.tryBeginUnauthorizedCleanup(requestGen)) return
      sessionGen.advanceSessionGeneration()
      cleanup()
    },
  }
}

describe('web bootstrap race guard simulation', () => {
  let sim: ReturnType<typeof createAuthSimulator>

  beforeEach(() => {
    sim = createAuthSimulator()
  })

  it('bootstrap A 200 after login B is ignored', () => {
    const bootstrapGen = sim.sessionGen.getSessionGeneration()
    sim.login('bob')
    sim.applyBootstrapFetchMe(bootstrapGen, 'success', 'alice')
    expect(sim.getState().user?.username).toBe('bob')
  })

  it('bootstrap A 401 after login B does not clear B', () => {
    const bootstrapGen = sim.sessionGen.getSessionGeneration()
    sim.login('bob')
    sim.applyBootstrapFetchMe(bootstrapGen, '401')
    expect(sim.getState().isLoggedIn).toBe(true)
    expect(sim.getState().user?.username).toBe('bob')
  })

  it('bootstrap A network error after login B leaves B intact', () => {
    const bootstrapGen = sim.sessionGen.getSessionGeneration()
    sim.login('bob')
    sim.applyBootstrapFetchMe(bootstrapGen, 'network')
    expect(sim.getState().user?.username).toBe('bob')
  })

  it('offline cache preserved when bootstrap network error on current generation', () => {
    const sim = createAuthSimulator()
    const bootstrapGen = sim.sessionGen.getSessionGeneration()
    sim.hydrate('alice')
    sim.applyBootstrapFetchMe(bootstrapGen, 'network')
    expect(sim.getState().isLoggedIn).toBe(true)
    expect(sim.getState().user?.username).toBe('alice')
    expect(sim.getState().authLoading).toBe(false)
  })
})

describe('stale 401 guard simulation', () => {
  it('stale protected 401 after login B is ignored', () => {
    const sim = createAuthSimulator()
    const requestGen = sim.sessionGen.getSessionGeneration()
    sim.login('bob')
    let cleaned = false
    sim.handleUnauthorized(requestGen, () => {
      cleaned = true
      sim.invalidateSession()
    })
    expect(cleaned).toBe(false)
    expect(sim.getState().isLoggedIn).toBe(true)
  })

  it('current B 401 triggers cleanup', () => {
    const sim = createAuthSimulator()
    sim.login('bob')
    const requestGen = sim.sessionGen.getSessionGeneration()
    sim.handleUnauthorized(requestGen, () => {
      sim.invalidateSession()
    })
    expect(sim.getState().isLoggedIn).toBe(false)
  })

  it('five parallel current 401s trigger one cleanup', () => {
    const sim = createAuthSimulator()
    sim.login('bob')
    const requestGen = sim.sessionGen.getSessionGeneration()
    let cleanups = 0
    const cleanup = () => {
      cleanups += 1
    }
    for (let i = 0; i < 5; i++) {
      sim.handleUnauthorized(requestGen, cleanup)
    }
    expect(cleanups).toBe(1)
  })
})

describe('account switch simulation', () => {
  it('A → logout → B → stale A response does not affect B', () => {
    const sim = createAuthSimulator()
    const bootstrapGen = sim.sessionGen.getSessionGeneration()
    sim.login('alice')
    sim.logout()
    sim.login('bob')
    sim.applyBootstrapFetchMe(bootstrapGen, 'success', 'alice')
    expect(sim.getState().user?.username).toBe('bob')
  })

  it('logout invalidates stale request generation', () => {
    const sim = createAuthSimulator()
    const requestGen = sim.sessionGen.getSessionGeneration()
    sim.login('alice')
    sim.logout()
    let applied = false
    sim.handleUnauthorized(requestGen, () => {
      applied = true
    })
    expect(applied).toBe(false)
  })
})

describe('current 401 local state consistency', () => {
  it('cleanup leaves consistent logged-out snapshot', () => {
    const sim = createAuthSimulator()
    sim.login('bob')
    const requestGen = sim.sessionGen.getSessionGeneration()
    sim.handleUnauthorized(requestGen, () => {
      sim.invalidateSession()
      sim.finishBootstrapLoading(requestGen)
    })
    const s = sim.getState()
    expect(s.isLoggedIn).toBe(false)
    expect(s.user).toBeNull()
  })
})
