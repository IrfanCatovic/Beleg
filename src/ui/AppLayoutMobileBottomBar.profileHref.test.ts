import { describe, expect, it } from 'vitest'
import { resolveMobileBottomBarProfileHref } from '../utils/profileIdentity'

describe('AppLayoutMobileBottomBar profile href', () => {
  it('never navigates to dead /profil route', () => {
    expect(resolveMobileBottomBarProfileHref({ username: 'ana' })).toBe('/korisnik/ana')
    expect(resolveMobileBottomBarProfileHref({ username: undefined })).toBe('/login')
    expect(resolveMobileBottomBarProfileHref({ username: '' })).toBe('/login')
    expect(resolveMobileBottomBarProfileHref({ username: null })).not.toBe('/profil')
  })
})
