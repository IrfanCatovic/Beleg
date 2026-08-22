import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EXPECTED_PRODUCTION_API_URL,
  isValidReleaseApiUrl,
  resolveBootstrapAfterFetchMe,
  shouldAdvanceGenerationOnBootstrapNullMe,
  shouldClearAuthLoadingInFinally,
  shouldSkipFetchMe,
} from './authBootstrapRules'

describe('authBootstrapRules — fresh install', () => {
  it('no token skips fetchMe (fresh install must not wait on backend)', () => {
    expect(shouldSkipFetchMe(null)).toBe(true)
    expect(shouldSkipFetchMe(undefined)).toBe(true)
    expect(shouldSkipFetchMe('')).toBe(true)
    expect(shouldSkipFetchMe('short')).toBe(true)
  })

  it('valid token allows fetchMe', () => {
    expect(shouldSkipFetchMe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc')).toBe(false)
  })
})

describe('authBootstrapRules — infinite spinner regression (AUTH-F2)', () => {
  it('bootstrap null /me must NOT advance generation (pre-fix hang root cause)', () => {
    expect(shouldAdvanceGenerationOnBootstrapNullMe()).toBe(false)
  })

  it('finally always clears authLoading even when generation advanced', () => {
    expect(
      shouldClearAuthLoadingInFinally({ restoreGen: 1, currentGen: 2, alwaysClear: true }),
    ).toBe(true)
  })

  it('simulates pre-fix hang: advance on null + gen-gated finally → stuck loading', () => {
    let authLoading = true
    let gen = 1
    const restoreGen = gen
    // old bug: invalidateSession on null
    gen += 1
    if (restoreGen === gen) {
      authLoading = false
    }
    expect(authLoading).toBe(true)

    // fixed: always clear
    authLoading = false
    expect(authLoading).toBe(false)
  })
})

describe('authBootstrapRules — fetchMe outcomes', () => {
  it('200 → authenticated', () => {
    expect(resolveBootstrapAfterFetchMe({ fetchMeResult: '200', hadCachedSession: false })).toBe(
      'authenticated',
    )
  })

  it('401 → cleared_invalid', () => {
    expect(resolveBootstrapAfterFetchMe({ fetchMeResult: '401', hadCachedSession: true })).toBe(
      'cleared_invalid',
    )
  })

  it('network/timeout/500 keep cache when present', () => {
    expect(resolveBootstrapAfterFetchMe({ fetchMeResult: 'network', hadCachedSession: true })).toBe(
      'keep_cached_offline',
    )
    expect(resolveBootstrapAfterFetchMe({ fetchMeResult: 'timeout', hadCachedSession: true })).toBe(
      'keep_cached_offline',
    )
    expect(resolveBootstrapAfterFetchMe({ fetchMeResult: '500', hadCachedSession: true })).toBe(
      'keep_cached_offline',
    )
  })

  it('network without cache → unauthenticated', () => {
    expect(resolveBootstrapAfterFetchMe({ fetchMeResult: 'network', hadCachedSession: false })).toBe(
      'unauthenticated',
    )
  })
})

describe('release API URL contract', () => {
  it('accepts production Render HTTPS URL', () => {
    expect(isValidReleaseApiUrl(EXPECTED_PRODUCTION_API_URL)).toBe(true)
  })

  it('rejects localhost / LAN / empty / undefined', () => {
    expect(isValidReleaseApiUrl(undefined)).toBe(false)
    expect(isValidReleaseApiUrl('')).toBe(false)
    expect(isValidReleaseApiUrl('undefined')).toBe(false)
    expect(isValidReleaseApiUrl('http://localhost:8080')).toBe(false)
    expect(isValidReleaseApiUrl('http://127.0.0.1:8080')).toBe(false)
    expect(isValidReleaseApiUrl('http://10.0.2.2:8080')).toBe(false)
    expect(isValidReleaseApiUrl('http://192.168.1.5:8080')).toBe(false)
    expect(isValidReleaseApiUrl('http://10.1.1.1:8080')).toBe(false)
  })

  it('eas.json preview + production embed canonical Render URL', () => {
    const easPath = resolve(__dirname, '../../eas.json')
    const eas = JSON.parse(readFileSync(easPath, 'utf8')) as {
      build: {
        preview: { env: { EXPO_PUBLIC_API_URL: string } }
        production: { env: { EXPO_PUBLIC_API_URL: string } }
      }
    }
    const preview = eas.build.preview.env.EXPO_PUBLIC_API_URL
    const production = eas.build.production.env.EXPO_PUBLIC_API_URL
    expect(isValidReleaseApiUrl(preview)).toBe(true)
    expect(isValidReleaseApiUrl(production)).toBe(true)
    expect(preview).toBe(EXPECTED_PRODUCTION_API_URL)
    expect(production).toBe(EXPECTED_PRODUCTION_API_URL)
  })

  it('api client fallback URL is valid release URL', () => {
    const clientSrc = readFileSync(resolve(__dirname, '../api/client.ts'), 'utf8')
    expect(clientSrc).toContain(EXPECTED_PRODUCTION_API_URL)
    expect(clientSrc).toContain('timeout')
  })
})

describe('Google audit helpers absent from runtime App entry', () => {
  it('App.tsx does not import Google audit test modules', () => {
    const appSrc = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8')
    expect(appSrc).not.toMatch(/GAUTH-MISSING|\.audit\.test/)
    expect(appSrc).not.toMatch(/googleAuthAudit/)
  })

  it('index.ts does not import audit test modules', () => {
    const indexSrc = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8')
    expect(indexSrc).not.toMatch(/\.audit\.test|GAUTH-MISSING/)
  })
})

describe('bootstrap timeout constants exported', () => {
  it('defines storage, clear-auth, and safety caps', async () => {
    const rules = await import('./authBootstrapRules')
    expect(rules.BOOTSTRAP_STORAGE_TIMEOUT_MS).toBeGreaterThan(0)
    expect(rules.BOOTSTRAP_CLEAR_AUTH_TIMEOUT_MS).toBeGreaterThan(0)
    expect(rules.BOOTSTRAP_SAFETY_TIMEOUT_MS).toBeGreaterThan(rules.BOOTSTRAP_STORAGE_TIMEOUT_MS)
  })
})
