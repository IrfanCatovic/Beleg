import { describe, expect, it, vi } from 'vitest'
import { finishClearAuthSideEffects, performMobileLogout } from './performMobileLogout'

describe('performMobileLogout (AuthContext logout wiring)', () => {
  it('cancel → logoutApi → clearAuthState; user/session clear radi i kad logoutApi padne', async () => {
    const calls: string[] = []
    const inFlight = { current: false }
    let user: { username: string } | null = { username: 'alice' }
    let isLoggedIn = true
    const storageRemoved: string[] = []

    await performMobileLogout({
      inFlight,
      cancelQueries: async () => {
        calls.push('cancel')
      },
      logoutApi: async () => {
        calls.push('logoutApi')
        throw new Error('network')
      },
      clearAuthState: async () => {
        calls.push('clearAuthState')
        isLoggedIn = false
        user = null
        await finishClearAuthSideEffects({
          clearStorageAndToken: async () => {
            storageRemoved.push('USER', 'IS_LOGGED_IN', 'TOKEN')
          },
          clearQueryState: async () => {
            calls.push('queryClear')
          },
        })
      },
    })

    expect(calls).toEqual(['cancel', 'logoutApi', 'clearAuthState', 'queryClear'])
    expect(user).toBeNull()
    expect(isLoggedIn).toBe(false)
    expect(storageRemoved).toEqual(['USER', 'IS_LOGGED_IN', 'TOKEN'])
    expect(inFlight.current).toBe(false)
  })

  it('double logout guard: drugi poziv se ignoriše dok traje prvi', async () => {
    const inFlight = { current: false }
    let clearCount = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const first = performMobileLogout({
      inFlight,
      cancelQueries: async () => undefined,
      logoutApi: async () => {
        await gate
      },
      clearAuthState: async () => {
        clearCount += 1
      },
    })

    await Promise.resolve()
    await performMobileLogout({
      inFlight,
      cancelQueries: async () => undefined,
      logoutApi: async () => undefined,
      clearAuthState: async () => {
        clearCount += 1
      },
    })

    release()
    await first
    expect(clearCount).toBe(1)
  })

  it('query clear se i dalje poziva kad storage cleanup padne', async () => {
    const queryClear = vi.fn(async () => undefined)
    await finishClearAuthSideEffects({
      clearStorageAndToken: async () => {
        throw new Error('secure store failed')
      },
      clearQueryState: queryClear,
    })
    expect(queryClear).toHaveBeenCalledTimes(1)
  })

  it('clearAuthState se poziva i kad cancelQueries padne', async () => {
    const clearAuthState = vi.fn(async () => undefined)
    await performMobileLogout({
      inFlight: { current: false },
      cancelQueries: async () => {
        throw new Error('cancel failed')
      },
      logoutApi: async () => undefined,
      clearAuthState,
    })
    expect(clearAuthState).toHaveBeenCalledTimes(1)
  })
})
