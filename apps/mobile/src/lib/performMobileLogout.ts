import {
  cancelAuthenticatedUserQueries,
  clearAuthenticatedUserQueryState,
} from './clearAuthenticatedUserQueryState'

export type LogoutInFlight = { current: boolean }

/**
 * Produkcijski redoslijed mobile logouta (cancel → server logout → clearAuthState).
 * Izdvojeno da wiring bude testabilan bez renderovanja cijelog AuthProvider-a.
 */
export async function performMobileLogout(opts: {
  inFlight: LogoutInFlight
  cancelQueries?: () => Promise<void>
  logoutApi: () => Promise<void>
  clearAuthState: () => Promise<void>
}): Promise<void> {
  if (opts.inFlight.current) return
  opts.inFlight.current = true
  try {
    try {
      await (opts.cancelQueries ?? cancelAuthenticatedUserQueries)()
    } catch {
      // ignore
    }
    try {
      await opts.logoutApi()
    } catch {
      // server logout nije kritičan — lokalni session mora nestati
    }
    await opts.clearAuthState()
  } finally {
    opts.inFlight.current = false
  }
}

/**
 * Dio clearAuthState nakon što su isLoggedIn/user već null:
 * storage/token cleanup + React Query clear (best-effort).
 */
export async function finishClearAuthSideEffects(opts: {
  clearStorageAndToken: () => Promise<void>
  clearQueryState?: () => Promise<void>
}): Promise<void> {
  try {
    await opts.clearStorageAndToken()
  } catch {
    // storage greška: caller i dalje drži user=null / isLoggedIn=false
  }
  try {
    await (opts.clearQueryState ?? clearAuthenticatedUserQueryState)()
  } catch {
    // best-effort cache clear
  }
}
