import { describe, expect, it } from 'vitest'
import * as auth from './index'

/**
 * Documents that shared auth has no Google/social login contract yet.
 * Classic login/register exports must remain.
 */

describe('GAUTH shared contract audit', () => {
  it('classic auth exports still exist', () => {
    expect(typeof auth.loginApi).toBe('function')
    expect(typeof auth.registerOpenApi).toBe('function')
    expect(typeof auth.fetchMe).toBe('function')
    expect(typeof auth.logoutApi).toBe('function')
    expect(typeof auth.computeProfileIncomplete).toBe('function')
  })

  it('expected Google/social API helper is missing — documented P0 gap', () => {
    const exported = auth as Record<string, unknown>
    const googleHelpers = [
      'googleLoginApi',
      'socialLoginApi',
      'completeGoogleOnboardingApi',
      'linkGoogleAccountApi',
    ]
    const present = googleHelpers.filter((name) => typeof exported[name] === 'function')
    if (present.length === 0) {
      throw new Error(
        'GAUTH-MISSING-SHARED-1 P0: no google/social login helper exported from @beleg/shared/auth',
      )
    }
  })
})
