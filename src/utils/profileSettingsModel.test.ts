import { describe, expect, it } from 'vitest'
import {
  PRIVACY_COPY,
  PROFILE_SETTINGS_FIELD_GROUPS,
  PROFILE_SETTINGS_SECTION_ORDER,
  buildGuideSettingsBlock,
  mapGuideProfileToCompletionStatus,
  publicProfilePath,
} from './profileSettingsModel'

describe('profileSettingsModel', () => {
  it('section order matches Faza D', () => {
    expect([...PROFILE_SETTINGS_SECTION_ORDER]).toEqual([
      'completion',
      'public',
      'private',
      'membership',
      'guide',
      'account',
    ])
  })

  it('maps guide profile statuses', () => {
    expect(mapGuideProfileToCompletionStatus(null)).toBe('none')
    expect(mapGuideProfileToCompletionStatus({ status: 'pending' })).toBe('pending')
    expect(mapGuideProfileToCompletionStatus({ status: 'approved' })).toBe('approved')
  })

  it('privacy copy is not absolute false', () => {
    expect(PRIVACY_COPY.privateHint).toMatch(/nisu javno prikazani/)
    expect(PRIVACY_COPY.privateHint).toMatch(/ovlašćenim osobama/)
    expect(PRIVACY_COPY.clubHint).toMatch(/nisu prikazane na javnom profilu/)
  })

  it('field groups stay separated', () => {
    expect(PROFILE_SETTINGS_FIELD_GROUPS.public).not.toEqual(
      expect.arrayContaining(['email', 'currentPassword']),
    )
    expect(PROFILE_SETTINGS_FIELD_GROUPS.membership).toEqual(
      expect.arrayContaining(['brojPlaninarskeLegitimacije', 'brojPlaninarskeMarkice', 'brojLicnogDokumenta']),
    )
  })

  it('public path encoding', () => {
    expect(publicProfilePath('user/name')).toBe('/korisnik/user%2Fname')
  })

  it('guide block rejects inventing approved edit', () => {
    const approved = buildGuideSettingsBlock('approved')
    expect(approved?.kind).toBe('approved')
    expect(approved && 'href' in approved ? approved.href : undefined).toBeUndefined()
  })
})
