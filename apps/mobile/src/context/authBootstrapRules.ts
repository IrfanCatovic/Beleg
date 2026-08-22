/**
 * Pure decisions for mobile AuthContext.restoreSession — unit-tested so the
 * infinite-spinner regressions cannot return silently.
 */

export type BootstrapOutcome =
  | 'unauthenticated'
  | 'authenticated'
  | 'keep_cached_offline'
  | 'cleared_invalid'

/** Fresh install / no JWT: never call fetchMe; end loading as logged out. */
export function shouldSkipFetchMe(token: string | null | undefined): boolean {
  return !token || token.length < 10
}

/**
 * When fetchMe returns null (401), clear local session but do NOT advance
 * session generation from bootstrap — advancing made `finally` skip
 * setAuthLoading(false) and left the APK on an infinite spinner.
 */
export function shouldAdvanceGenerationOnBootstrapNullMe(): boolean {
  return false
}

/** Bootstrap that owns authLoading must always clear it in finally. */
export function shouldClearAuthLoadingInFinally(opts: {
  restoreGen: number
  currentGen: number
  /** After fix: always true. Kept as param for regression tests. */
  alwaysClear?: boolean
}): boolean {
  if (opts.alwaysClear !== false) return true
  return opts.restoreGen === opts.currentGen
}

export function resolveBootstrapAfterFetchMe(opts: {
  fetchMeResult: '200' | '401' | 'network' | 'timeout' | '500'
  hadCachedSession: boolean
}): BootstrapOutcome {
  switch (opts.fetchMeResult) {
    case '200':
      return 'authenticated'
    case '401':
      return 'cleared_invalid'
    case 'network':
    case 'timeout':
    case '500':
      return opts.hadCachedSession ? 'keep_cached_offline' : 'unauthenticated'
    default:
      return 'unauthenticated'
  }
}

/** Production / preview API URL must be the Render HTTPS backend. */
export function isValidReleaseApiUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  if (!trimmed.startsWith('https://')) return false
  const lower = trimmed.toLowerCase()
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('10.0.2.2') ||
    /https?:\/\/192\.168\./i.test(trimmed) ||
    /https?:\/\/10\./i.test(trimmed)
  ) {
    return false
  }
  return true
}

export const EXPECTED_PRODUCTION_API_URL = 'https://planiner-api.onrender.com'

/** SecureStore / AsyncStorage reads during cold start — must not hang forever on Android APK. */
export const BOOTSTRAP_STORAGE_TIMEOUT_MS = 8_000

/** Best-effort session cleanup during bootstrap — must not block loading dismissal. */
export const BOOTSTRAP_CLEAR_AUTH_TIMEOUT_MS = 5_000

/** Last-resort cap so authLoading always clears even if an await never settles. */
export const BOOTSTRAP_SAFETY_TIMEOUT_MS = 30_000
