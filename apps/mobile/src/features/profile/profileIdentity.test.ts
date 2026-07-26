import { describe, expect, it } from 'vitest'
import {
  buildGuideExperienceA11yLabel,
  formatGuideAverageDisplay,
  getGuideRatingPresentation,
  readGuideRatingSummary,
} from './profileIdentity'
import { shouldShowPublicAdminRoleBadge } from '../../utils/profilePassportKpis'

describe('mobile profileIdentity', () => {
  it('shows club-safe long name helper via presentation without crash', () => {
    const long = 'Planinarsko društvo '.repeat(6)
    expect(long.length).toBeGreaterThan(40)
    expect(getGuideRatingPresentation({ brojOcena: 0 }).emptyLabel).toBe('Još nema ocjena')
  })

  it('does not show 0.0 for guides without reviews', () => {
    expect(formatGuideAverageDisplay(0)).toBeNull()
    expect(getGuideRatingPresentation({ prosecnaOcena: 0, brojOcena: 0 }).averageLabel).toBeNull()
  })

  it('builds a11y label with rating and review count', () => {
    const label = buildGuideExperienceA11yLabel({
      hasRatings: true,
      averageLabel: '4,9',
      reviewCount: 12,
      guidedCount: 8,
    })
    expect(label).toContain('Profi vodič')
    expect(label).toContain('4,9')
    expect(label).toContain('12')
  })

  it('reads guideRatingSummary from profile payload', () => {
    expect(
      readGuideRatingSummary({
        guideRatingSummary: { prosecnaOcena: 4.5, brojOcena: 3, brojKomentara: 2 },
      }),
    ).toEqual({ prosecnaOcena: 4.5, brojOcena: 3, brojKomentara: 2 })
    expect(readGuideRatingSummary({})).toBeNull()
  })

  it('keeps admin roles out of public identity', () => {
    expect(shouldShowPublicAdminRoleBadge('sekretar')).toBe(false)
  })
})
