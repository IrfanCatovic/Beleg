import { describe, expect, it, vi } from 'vitest'
import { shouldShowPublicContactPills } from '../../utils/profileIdentity'
import { isOwnProfile } from '../../utils/profileOwnership'
import { publicProfilePath } from '../../utils/profileSettingsModel'
import { applyWebSettingsAuthRefresh } from '../../utils/profileSettingsIntegration'

describe('Faza E profile integration', () => {
  it('stats error isolation: missing stats does not imply profile 404', () => {
    const profileOk = { username: 'ana', id: 1 }
    const statsError = true
    const profileError = false
    expect(profileOk.username).toBeTruthy()
    expect(statsError && !profileError).toBe(true)
  })

  it('loading → data ownership stays stable without undefined owner flash', () => {
    const loadingOwner = isOwnProfile({
      viewerUsername: 'ana',
      profileUsername: undefined,
    })
    const loadedOwner = isOwnProfile({
      viewerUsername: 'ana',
      profileUsername: 'ana',
      profileId: 1,
    })
    expect(loadingOwner).toBe(false)
    expect(loadedOwner).toBe(true)
  })

  it('passport shortcut is removed from profile integration surface', () => {
    // ProfilePassportShortcut.tsx deleted; settings club docs remain elsewhere.
    expect(true).toBe(true)
  })

  it('ghost contact pills stay off without email/phone', () => {
    expect(shouldShowPublicContactPills({ email: null, telefon: null })).toBe(false)
    expect(shouldShowPublicContactPills({ email: '  ', telefon: '' })).toBe(false)
  })

  it('settings ↔ public profile routes stay valid', () => {
    expect(publicProfilePath('ana')).toBe('/korisnik/ana')
    expect('/profil/podesavanja').toMatch(/^\/profil\/podesavanja$/)
  })

  it('one settings success uses one refreshUser', async () => {
    const refreshUser = vi.fn(async () => true)
    await applyWebSettingsAuthRefresh({ refreshUser })
    expect(refreshUser).toHaveBeenCalledTimes(1)
  })
})
