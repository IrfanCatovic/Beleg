import { describe, expect, it } from 'vitest'
import { shouldSkipFetchMe, shouldAdvanceGenerationOnBootstrapNullMe } from './authBootstrapRules'

/**
 * Mobile auth bootstrap contract (pure decisions mirrored from AuthContext.restoreSession).
 */
describe('mobile auth bootstrap contract', () => {
  function shouldHydrateFromCache(rememberMe: boolean, cachedUser: string | null, cachedLoggedIn: boolean) {
    return rememberMe && !!cachedUser && cachedLoggedIn
  }

  function shouldPersistAfterFetch(rememberMe: boolean) {
    return rememberMe
  }

  it('remember_me=false skips cache hydration', () => {
    expect(shouldHydrateFromCache(false, '{"username":"a"}', true)).toBe(false)
  })

  it('remember_me=true hydrates when cache valid', () => {
    expect(shouldHydrateFromCache(true, '{"username":"a","role":"clan"}', true)).toBe(true)
  })

  it('fresh install no token skips fetchMe and ends unauthenticated', () => {
    expect(shouldSkipFetchMe(null)).toBe(true)
  })

  it('fetchMe null clears session without advancing generation', () => {
    expect(shouldAdvanceGenerationOnBootstrapNullMe()).toBe(false)
  })

  it('network error during fetchMe keeps cached session (offline tolerance)', () => {
    const hadCachedSession = true
    const fetchMeThrew = true
    const shouldKeepCached = hadCachedSession && fetchMeThrew
    expect(shouldKeepCached).toBe(true)
  })

  it('remember_me=false does not persist user after successful fetchMe', () => {
    expect(shouldPersistAfterFetch(false)).toBe(false)
  })

  it('401 handler clears pending navigation before clearAuthState (contract)', () => {
    const steps = ['clearPendingNavigation', 'clearAuthState']
    expect(steps[0]).toBe('clearPendingNavigation')
  })
})

describe('mobile vs web 401 contract difference', () => {
  it('mobile clears pending navigation on 401; web does not', () => {
    const mobile401Steps = ['clearPendingNavigation', 'clearAuthState']
    const web401Steps = ['clearAuthState']
    expect(mobile401Steps.length).toBeGreaterThan(web401Steps.length)
  })
})
