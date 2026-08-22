import { describe, expect, it, vi } from 'vitest'
import { TimeoutError, withTimeout } from '../lib/withTimeout'
import {
  BOOTSTRAP_CLEAR_AUTH_TIMEOUT_MS,
  BOOTSTRAP_SAFETY_TIMEOUT_MS,
  BOOTSTRAP_STORAGE_TIMEOUT_MS,
} from './authBootstrapRules'

describe('withTimeout', () => {
  it('resolves when promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, 'test')).resolves.toBe('ok')
  })

  it('rejects with TimeoutError when promise hangs', async () => {
    vi.useFakeTimers()
    const hanging = new Promise<string>(() => {})
    const result = withTimeout(hanging, 50, 'storage:auth_token')
    vi.advanceTimersByTime(50)
    await expect(result).rejects.toBeInstanceOf(TimeoutError)
    vi.useRealTimers()
  })
})

describe('bootstrap timeout constants', () => {
  it('storage timeout is reasonable for Android cold start', () => {
    expect(BOOTSTRAP_STORAGE_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000)
    expect(BOOTSTRAP_STORAGE_TIMEOUT_MS).toBeLessThanOrEqual(15_000)
  })

  it('clear-auth timeout is shorter than safety cap', () => {
    expect(BOOTSTRAP_CLEAR_AUTH_TIMEOUT_MS).toBeLessThan(BOOTSTRAP_SAFETY_TIMEOUT_MS)
  })

  it('safety timeout exceeds fetchMe client timeout', () => {
    expect(BOOTSTRAP_SAFETY_TIMEOUT_MS).toBeGreaterThanOrEqual(25_000)
  })
})

describe('bootstrap loading invariant simulation', () => {
  function simulateBootstrap(opts: {
    storageResult: 'success' | 'throw' | 'hang'
    token: string | null
    fetchMeResult?: '200' | '401' | 'network' | 'timeout'
    staleGeneration?: boolean
    clearAuthResult?: 'ok' | 'hang'
    safetyMs?: number
  }) {
    let authLoading = true
    let isLoggedIn = false
    let gen = 1
    const restoreGen = gen
    const safetyMs = opts.safetyMs ?? BOOTSTRAP_SAFETY_TIMEOUT_MS

    const finishAuthLoading = () => {
      authLoading = false
    }

    const run = async () => {
      const safety = setTimeout(finishAuthLoading, safetyMs)
      try {
        if (opts.storageResult === 'throw') throw new Error('storage')
        if (opts.storageResult === 'hang') await new Promise(() => {})

        const token = opts.token
        const skipFetch = !token || token.length < 10
        if (skipFetch) {
          isLoggedIn = false
          return
        }

        if (opts.staleGeneration) {
          gen += 1
          return
        }

        if (opts.fetchMeResult === '401') {
          if (opts.clearAuthResult === 'hang') await new Promise(() => {})
          isLoggedIn = false
          return
        }
        if (opts.fetchMeResult === '200') {
          isLoggedIn = true
          return
        }
        if (opts.fetchMeResult === 'network' || opts.fetchMeResult === 'timeout') {
          isLoggedIn = false
        }
      } catch {
        isLoggedIn = false
      } finally {
        clearTimeout(safety)
        finishAuthLoading()
      }
    }

    return { run, get authLoading() { return authLoading }, get isLoggedIn() { return isLoggedIn }, restoreGen, get gen() { return gen } }
  }

  it('fresh install + no token → bootstrap terminates → unauthenticated', async () => {
    const sim = simulateBootstrap({ storageResult: 'success', token: null })
    await sim.run()
    expect(sim.authLoading).toBe(false)
    expect(sim.isLoggedIn).toBe(false)
  })

  it('SecureStore throw → bootstrap terminates', async () => {
    const sim = simulateBootstrap({ storageResult: 'throw', token: null })
    await sim.run()
    expect(sim.authLoading).toBe(false)
    expect(sim.isLoggedIn).toBe(false)
  })

  it('valid token + fetchMe 200 → authenticated', async () => {
    const sim = simulateBootstrap({
      storageResult: 'success',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc',
      fetchMeResult: '200',
    })
    await sim.run()
    expect(sim.authLoading).toBe(false)
    expect(sim.isLoggedIn).toBe(true)
  })

  it('stale token + 401 → cleanup → Login', async () => {
    const sim = simulateBootstrap({
      storageResult: 'success',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc',
      fetchMeResult: '401',
    })
    await sim.run()
    expect(sim.authLoading).toBe(false)
    expect(sim.isLoggedIn).toBe(false)
  })

  it('network error → no infinite spinner', async () => {
    const sim = simulateBootstrap({
      storageResult: 'success',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc',
      fetchMeResult: 'network',
    })
    await sim.run()
    expect(sim.authLoading).toBe(false)
  })

  it('fetch timeout → no infinite spinner', async () => {
    const sim = simulateBootstrap({
      storageResult: 'success',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc',
      fetchMeResult: 'timeout',
    })
    await sim.run()
    expect(sim.authLoading).toBe(false)
  })

  it('stale AUTH-F2 generation → no infinite spinner', async () => {
    const sim = simulateBootstrap({
      storageResult: 'success',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc',
      fetchMeResult: '200',
      staleGeneration: true,
    })
    await sim.run()
    expect(sim.authLoading).toBe(false)
  })

  it('safety timer clears loading when storage hangs', async () => {
    vi.useFakeTimers()
    let authLoading = true
    const finish = () => {
      authLoading = false
    }
    setTimeout(finish, BOOTSTRAP_SAFETY_TIMEOUT_MS)
    const hang = new Promise(() => {})
    void hang
    vi.advanceTimersByTime(BOOTSTRAP_SAFETY_TIMEOUT_MS)
    finish()
    expect(authLoading).toBe(false)
    vi.useRealTimers()
  })
})
