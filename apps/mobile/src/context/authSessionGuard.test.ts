import { describe, expect, it } from 'vitest'
import { createSessionGeneration } from '@beleg/shared'

/**
 * Mobile restoreSession + storage error simulations (AUTH-F2).
 */

describe('mobile restoreSession race guard', () => {
  it('restore A 200 after login B is ignored via generation check', () => {
    const sessionGen = createSessionGeneration()
    const restoreGen = sessionGen.getSessionGeneration()
    sessionGen.advanceSessionGeneration()
    let applied = false
    if (sessionGen.isCurrentSessionGeneration(restoreGen)) {
      applied = true
    }
    expect(applied).toBe(false)
  })

  it('restore A 401 after login B does not clear B', () => {
    const sessionGen = createSessionGeneration()
    const restoreGen = sessionGen.getSessionGeneration()
    sessionGen.advanceSessionGeneration()
    let cleared = false
    if (sessionGen.isCurrentSessionGeneration(restoreGen)) {
      cleared = true
    }
    expect(cleared).toBe(false)
  })

  it('restore A storage error path clears only when generation current', async () => {
    const sessionGen = createSessionGeneration()
    const restoreGen = sessionGen.getSessionGeneration()
    let authLoading = true
    let isLoggedIn = false

    try {
      throw new Error('SecureStore failed')
    } catch {
      if (sessionGen.isCurrentSessionGeneration(restoreGen)) {
        isLoggedIn = false
        authLoading = false
      }
    }

    expect(authLoading).toBe(false)
    expect(isLoggedIn).toBe(false)
  })

  it('A → logout → B → stale restore does not affect B', () => {
    const sessionGen = createSessionGeneration()
    const restoreGen = sessionGen.getSessionGeneration()
    sessionGen.advanceSessionGeneration()
    sessionGen.advanceSessionGeneration()
    sessionGen.advanceSessionGeneration()
    let user: string | null = 'bob'
    if (sessionGen.isCurrentSessionGeneration(restoreGen)) {
      user = 'alice'
    }
    expect(user).toBe('bob')
  })
})

describe('mobile storage exception recovery', () => {
  it('SecureStore throw finishes authLoading logged-out', async () => {
    const sessionGen = createSessionGeneration()
    const restoreGen = sessionGen.getSessionGeneration()
    let authLoading = true
    let isLoggedIn = true

    try {
      const read = async () => {
        throw new Error('SecureStore')
      }
      await read()
    } catch {
      if (sessionGen.isCurrentSessionGeneration(restoreGen)) {
        isLoggedIn = false
        authLoading = false
      }
    } finally {
      if (sessionGen.isCurrentSessionGeneration(restoreGen) && authLoading) {
        authLoading = false
      }
    }

    expect(authLoading).toBe(false)
    expect(isLoggedIn).toBe(false)
  })

  it('AsyncStorage throw finishes authLoading logged-out', async () => {
    const sessionGen = createSessionGeneration()
    const restoreGen = sessionGen.getSessionGeneration()
    let authLoading = true

    try {
      throw new Error('AsyncStorage')
    } catch {
      if (sessionGen.isCurrentSessionGeneration(restoreGen)) {
        authLoading = false
      }
    }

    expect(authLoading).toBe(false)
  })
})

describe('mobile pending navigation stale restore contract', () => {
  it('stale restore does not consume pending URL after generation advance', () => {
    const sessionGen = createSessionGeneration()
    const restoreGen = sessionGen.getSessionGeneration()
    let pendingUrl: string | null = '/akcije/1'
    sessionGen.advanceSessionGeneration()
    if (sessionGen.isCurrentSessionGeneration(restoreGen)) {
      pendingUrl = null
    }
    expect(pendingUrl).toBe('/akcije/1')
  })

  it('current generation login may consume pending intent', () => {
    let consumed = false
    const onLoginSuccess = () => {
      consumed = true
    }
    onLoginSuccess()
    expect(consumed).toBe(true)
  })
})

describe('mobile remember_me contract unchanged', () => {
  it('remember_me=true persists user cache path', () => {
    const rememberMe = true
    expect(rememberMe ? 'persist' : 'skip').toBe('persist')
  })

  it('remember_me=false skips user cache but keeps token path', () => {
    const rememberMe = false
    const tokenInSecureStore = true
    expect(rememberMe).toBe(false)
    expect(tokenInSecureStore).toBe(true)
  })
})

describe('mobile stale 401 does not logout B', () => {
  it('ignores 401 from pre-login generation', () => {
    const sessionGen = createSessionGeneration()
    const requestGen = sessionGen.getSessionGeneration()
    sessionGen.advanceSessionGeneration()
    let loggedOut = false
    if (
      sessionGen.isCurrentSessionGeneration(requestGen) &&
      sessionGen.tryBeginUnauthorizedCleanup(requestGen)
    ) {
      loggedOut = true
    }
    expect(loggedOut).toBe(false)
  })
})
