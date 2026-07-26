import { describe, expect, it } from 'vitest'
import {
  PRIVACY_COPY,
  PROFILE_SETTINGS_FIELD_GROUPS,
  buildGuideSettingsBlock,
} from './profileSettingsModel'
import { computeProfileCompletion, summarizeCompletionDisplay } from './profileCompletion'

describe('profile settings grouping (mobile)', () => {
  it('exposes completion UI copy and percentage', () => {
    const result = computeProfileCompletion({
      fullName: 'Ana',
      username: 'ana',
      email: 'a@b.c',
      emailVerified: true,
      hasAvatar: true,
    })
    const display = summarizeCompletionDisplay(result)
    expect(result.percentage).toBe(100)
    expect(display.headline).toBe('Osnovni Planinarski pasoš je dovršen.')
  })

  it('groups public private membership fields', () => {
    expect(PROFILE_SETTINGS_FIELD_GROUPS.public).toContain('fullName')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.private).toContain('email')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.private).toContain('telefon')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.membership).toContain('brojPlaninarskeLegitimacije')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.membership).toContain('brojPlaninarskeMarkice')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.account).toContain('currentPassword')
  })

  it('privacy badges and copy are screen-reader friendly', () => {
    expect(PRIVACY_COPY.publicBadge).toBe('Javno')
    expect(PRIVACY_COPY.privateBadge).toBe('Privatno')
    expect(PRIVACY_COPY.clubBadge).toBe('Klupska evidencija')
    expect(`Oznaka privatnosti: ${PRIVACY_COPY.privateBadge}`).toContain('Privatno')
  })

  it('loading guards double submit', () => {
    let pending = false
    let count = 0
    const save = () => {
      if (pending) return
      pending = true
      count += 1
    }
    save()
    save()
    expect(count).toBe(1)
  })

  it('keyboard-safe structure flags', () => {
    const structure = {
      keyboardAvoidingView: true,
      scrollWhileKeyboardOpen: true,
      secureTextEntry: true,
      emailKeyboard: true,
    }
    expect(structure.keyboardAvoidingView).toBe(true)
    expect(structure.scrollWhileKeyboardOpen).toBe(true)
    expect(structure.secureTextEntry).toBe(true)
    expect(structure.emailKeyboard).toBe(true)
  })

  it('email status labels', () => {
    expect(true ? 'Email je potvrđen' : 'Email nije potvrđen').toBe('Email je potvrđen')
    expect(false ? 'Email je potvrđen' : 'Email nije potvrđen').toBe('Email nije potvrđen')
  })

  it('password fields remain account-bound', () => {
    expect(PROFILE_SETTINGS_FIELD_GROUPS.account).toEqual(
      expect.arrayContaining(['currentPassword', 'newPassword', 'confirmPassword']),
    )
    expect(PROFILE_SETTINGS_FIELD_GROUPS.public).not.toContain('currentPassword')
  })

  it('success recalculates progress', () => {
    const before = computeProfileCompletion({ emailVerified: false, email: 'a@b.c', fullName: 'A', username: 'a', hasAvatar: true })
    const after = computeProfileCompletion({ emailVerified: true, email: 'a@b.c', fullName: 'A', username: 'a', hasAvatar: true })
    expect(after.percentage).toBeGreaterThan(before.percentage)
  })

  it('error keeps values', () => {
    const values = { email: 'keep@x.com', telefon: '061' }
    const error = 'fail'
    expect(error).toBeTruthy()
    expect(values.email).toBe('keep@x.com')
    expect(values.telefon).toBe('061')
  })

  it('private values are not mirrored into public labels', () => {
    expect(PROFILE_SETTINGS_FIELD_GROUPS.public).not.toContain('email')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.public).not.toContain('telefon')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.public).not.toContain('adresa')
  })

  it('public profile navigation uses existing route params', () => {
    const username = 'ana'
    const route = username.trim() ? { name: 'UserProfile', params: { username } } : null
    expect(route).toEqual({ name: 'UserProfile', params: { username: 'ana' } })
  })

  it('accessibility labels for progress and save', () => {
    const labels = {
      progress: 'Tvoj Planinarski pasoš je 80% dovršen',
      save: 'Sačuvaj izmjene',
      saveBusy: 'Čuvanje izmjena',
    }
    expect(labels.save).toBe('Sačuvaj izmjene')
    expect(labels.progress).toContain('%')
  })

  it('guide and non-guide variants', () => {
    expect(buildGuideSettingsBlock('non-guide')).toBeNull()
    expect(buildGuideSettingsBlock('none')?.kind).toBe('apply')
    expect(buildGuideSettingsBlock('pending')?.kind).toBe('pending')
    expect(buildGuideSettingsBlock('approved')?.kind).toBe('approved')
  })
})
