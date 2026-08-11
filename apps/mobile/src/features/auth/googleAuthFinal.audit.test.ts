import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string) {
  return readFileSync(join(here, rel), 'utf8')
}

describe('GAUTH mobile/web surface audit', () => {
  it('mobile LoginScreen has no Google continue button', () => {
    const src = read('./LoginScreen.tsx')
    expect(src.includes('loginApi')).toBe(true)
    if (/Google|google-signin|idToken|Nastavi pomoću Google/i.test(src)) {
      return
    }
    throw new Error('GAUTH-MISSING-MOBILE-1 P0: LoginScreen has no Google Sign-In entry')
  })

  it('mobile AuthStack has no Google onboarding screen', () => {
    const src = read('../../navigation/stacks/AuthStack.tsx')
    if (/GoogleOnboarding|SocialOnboarding|GoogleComplete/i.test(src)) {
      return
    }
    throw new Error('GAUTH-MISSING-MOBILE-2 P0: AuthStack has no Google onboarding route')
  })

  it('mobile package.json has no Google Sign-In native dependency', () => {
    const pkg = read('../../../package.json')
    if (
      pkg.includes('@react-native-google-signin/google-signin') ||
      pkg.includes('expo-auth-session') ||
      pkg.includes('expo-apple-authentication')
    ) {
      return
    }
    throw new Error(
      'GAUTH-MISSING-MOBILE-3 P0: no Google/Apple native auth dependency in apps/mobile/package.json',
    )
  })
})
