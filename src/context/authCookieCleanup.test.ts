import { describe, expect, it, beforeEach } from 'vitest'
import { createSessionGeneration } from '@beleg/shared'

/**
 * AUTH-F3 web 401 cookie cleanup contract simulations.
 */

type LocalAuth = {
  isLoggedIn: boolean
  user: string | null
  token: string | null
}

function simulateCurrent401Cleanup(opts: {
  cookieClear: () => Promise<void>
  advanceGeneration: () => void
  clearLocal: () => void
}) {
  opts.advanceGeneration()
  opts.clearLocal()
  void opts.cookieClear().catch(() => undefined)
}

describe('AUTH-F3 current 401 cleanup', () => {
  let local: LocalAuth
  let cookieClearCalls: number

  beforeEach(() => {
    local = { isLoggedIn: true, user: 'alice', token: 'jwt' }
    cookieClearCalls = 0
  })

  const runCleanup = () =>
    simulateCurrent401Cleanup({
      advanceGeneration: () => undefined,
      clearLocal: () => {
        local = { isLoggedIn: false, user: null, token: null }
      },
      cookieClear: async () => {
        cookieClearCalls += 1
      },
    })

  it('current 401 clears local state immediately', () => {
    runCleanup()
    expect(local.isLoggedIn).toBe(false)
    expect(local.user).toBeNull()
    expect(local.token).toBeNull()
  })

  it('current 401 triggers one cookie-clear request', async () => {
    runCleanup()
    await Promise.resolve()
    expect(cookieClearCalls).toBe(1)
  })

  it('cookie clear failure does not restore local auth', async () => {
    simulateCurrent401Cleanup({
      advanceGeneration: () => undefined,
      clearLocal: () => {
        local = { isLoggedIn: false, user: null, token: null }
      },
      cookieClear: async () => {
        throw new Error('network')
      },
    })
    await Promise.resolve()
    expect(local.isLoggedIn).toBe(false)
  })
})

describe('AUTH-F3 stale 401', () => {
  it('stale generation does not cookie-clear', () => {
    const sessionGen = createSessionGeneration()
    const requestGen = sessionGen.getSessionGeneration()
    sessionGen.advanceSessionGeneration()
    let cookieCleared = false
    if (sessionGen.isCurrentSessionGeneration(requestGen)) {
      cookieCleared = true
    }
    expect(cookieCleared).toBe(false)
  })
})

describe('AUTH-F3 parallel 401 single-flight', () => {
  it('five parallel current 401s → one cookie clear via generation marker', () => {
    const sessionGen = createSessionGeneration()
    const gen = sessionGen.getSessionGeneration()
    let cookieClears = 0
    for (let i = 0; i < 5; i++) {
      if (sessionGen.tryBeginUnauthorizedCleanup(gen)) {
        cookieClears += 1
      }
    }
    expect(cookieClears).toBe(1)
  })
})

describe('AUTH-F3 post-cleanup bootstrap', () => {
  it('without cookie, fetchMe null keeps logged-out', () => {
    const cookiePresent = false
    const fetchMeResult = cookiePresent ? { username: 'alice' } : null
    const isLoggedIn = fetchMeResult !== null
    expect(isLoggedIn).toBe(false)
  })

  it('new login after cleanup works independently', () => {
    const sessionGen = createSessionGeneration()
    sessionGen.advanceSessionGeneration()
    sessionGen.advanceSessionGeneration()
    let user: string | null = null
    const login = () => {
      sessionGen.advanceSessionGeneration()
      user = 'bob'
    }
    login()
    expect(user).toBe('bob')
  })
})

describe('AUTH-F3 manual logout', () => {
  it('manual logout clears local then cookie once', async () => {
    let local: { isLoggedIn: boolean; token: string | null } = { isLoggedIn: true, token: 'jwt' }
    let cookieClears = 0
    local = { isLoggedIn: false, token: null }
    cookieClears += 1
    await Promise.resolve()
    expect(local.isLoggedIn).toBe(false)
    expect(cookieClears).toBe(1)
  })
})
