import { describe, expect, it } from 'vitest'
import {
  buildClubPublicPath,
  buildGuideExperienceA11yLabel,
  canLinkToClubProfile,
  formatGuideAverageDisplay,
  getGuideRatingPresentation,
  resolveMobileBottomBarProfileHref,
  resolveSameClub,
  shouldShowPublicContactPills,
} from './profileIdentity'

describe('profileIdentity', () => {
  it('sameClub only when both klubIds are numbers', () => {
    expect(resolveSameClub({ viewerKlubId: 1, profileKlubId: 1 })).toBe(true)
    expect(resolveSameClub({ viewerKlubId: 1, profileKlubId: 2 })).toBe(false)
    expect(resolveSameClub({ viewerKlubId: 1, profileKlubId: undefined })).toBe(false)
    expect(resolveSameClub({ viewerKlubId: undefined, profileKlubId: 1 })).toBe(false)
  })

  it('does not show contact pills without values', () => {
    expect(shouldShowPublicContactPills({})).toBe(false)
    expect(shouldShowPublicContactPills({ email: 'a@b.c' })).toBe(true)
  })

  it('builds club path and gates link on auth', () => {
    expect(buildClubPublicPath('PD Maglić')).toBe(`/klubovi/${encodeURIComponent('PD Maglić')}`)
    expect(canLinkToClubProfile({ klubNaziv: 'PD', isAuthenticated: true })).toBe(true)
    expect(canLinkToClubProfile({ klubNaziv: 'PD', isAuthenticated: false })).toBe(false)
    expect(canLinkToClubProfile({ klubNaziv: '', isAuthenticated: true })).toBe(false)
  })

  it('guide without reviews shows empty label not 0.0', () => {
    const empty = getGuideRatingPresentation({ prosecnaOcena: 0, brojOcena: 0 })
    expect(empty.hasRatings).toBe(false)
    expect(empty.averageLabel).toBeNull()
    expect(empty.emptyLabel).toBe('Još nema ocjena')
    expect(formatGuideAverageDisplay(0)).toBeNull()
    expect(formatGuideAverageDisplay(Number.NaN)).toBeNull()
  })

  it('guide with ratings formats average', () => {
    const p = getGuideRatingPresentation({ prosecnaOcena: 4.9, brojOcena: 12 })
    expect(p.hasRatings).toBe(true)
    expect(p.averageLabel).toMatch(/4[,.]9/)
    expect(buildGuideExperienceA11yLabel({
      hasRatings: true,
      averageLabel: '4,9',
      reviewCount: 12,
      guidedCount: 8,
    })).toContain('Profi vodič')
    expect(buildGuideExperienceA11yLabel({
      hasRatings: true,
      averageLabel: '4,9',
      reviewCount: 12,
      guidedCount: 8,
    })).toContain('4,9')
  })

  it('bottom bar never falls back to /profil', () => {
    expect(resolveMobileBottomBarProfileHref({ username: 'ana' })).toBe('/korisnik/ana')
    expect(resolveMobileBottomBarProfileHref({ username: null })).toBe('/login')
    expect(resolveMobileBottomBarProfileHref({ username: '' })).not.toContain('/profil')
  })
})
