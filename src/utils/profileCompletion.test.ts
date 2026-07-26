import { describe, expect, it } from 'vitest'
import {
  computeProfileCompletion,
  hasMembershipDocsFilled,
  summarizeCompletionDisplay,
  type ProfileCompletionInput,
} from './profileCompletion'

const completeBasic: ProfileCompletionInput = {
  fullName: 'Ana Anić',
  username: 'ana',
  email: 'ana@example.com',
  emailVerified: true,
  hasAvatar: true,
  hasCover: false,
  hasClub: false,
  hasMembershipDocs: false,
  guideStatus: 'non-guide',
}

describe('computeProfileCompletion', () => {
  it('empty profile is 0% with ordered missing items', () => {
    const result = computeProfileCompletion({})
    expect(result.percentage).toBe(0)
    expect(result.completed).toBe(0)
    expect(result.total).toBe(5)
    expect(result.missing.map((m) => m.id)).toEqual([
      'fullName',
      'username',
      'email',
      'emailVerified',
      'avatar',
    ])
    expect(Number.isNaN(result.percentage)).toBe(false)
  })

  it('complete basic profile is 100%', () => {
    const result = computeProfileCompletion(completeBasic)
    expect(result.percentage).toBe(100)
    expect(result.isBasicComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('whitespace counts as empty', () => {
    const result = computeProfileCompletion({
      fullName: '   ',
      username: '\t',
      email: ' ',
      emailVerified: false,
      hasAvatar: false,
    })
    expect(result.completed).toBe(0)
    expect(result.missing.map((m) => m.id)).toContain('fullName')
    expect(result.missing.map((m) => m.id)).toContain('username')
    expect(result.missing.map((m) => m.id)).toContain('email')
  })

  it('unverified email is missing even when email present', () => {
    const result = computeProfileCompletion({
      ...completeBasic,
      emailVerified: false,
    })
    expect(result.percentage).toBe(80)
    expect(result.missing.map((m) => m.id)).toEqual(['emailVerified'])
  })

  it('club does not affect basic percentage', () => {
    const withoutClub = computeProfileCompletion({ ...completeBasic, hasClub: false })
    const withClub = computeProfileCompletion({ ...completeBasic, hasClub: true })
    expect(withoutClub.percentage).toBe(withClub.percentage)
    expect(withoutClub.percentage).toBe(100)
    expect(withoutClub.recommendations.some((r) => r.id === 'club')).toBe(true)
    expect(withClub.recommendations.some((r) => r.id === 'club')).toBe(false)
  })

  it('non-guide does not get guide missing/recommendation', () => {
    const result = computeProfileCompletion({ ...completeBasic, guideStatus: 'non-guide' })
    expect(result.missing.some((m) => m.id === 'guide')).toBe(false)
    expect(result.recommendations.some((r) => r.id === 'guide')).toBe(false)
  })

  it('relevant guide status gets guide recommendation', () => {
    const none = computeProfileCompletion({ ...completeBasic, guideStatus: 'none' })
    const rejected = computeProfileCompletion({ ...completeBasic, guideStatus: 'rejected' })
    const pending = computeProfileCompletion({ ...completeBasic, guideStatus: 'pending' })
    const approved = computeProfileCompletion({ ...completeBasic, guideStatus: 'approved' })
    expect(none.recommendations.some((r) => r.id === 'guide')).toBe(true)
    expect(rejected.recommendations.some((r) => r.id === 'guide')).toBe(true)
    expect(pending.recommendations.some((r) => r.id === 'guide')).toBe(false)
    expect(approved.recommendations.some((r) => r.id === 'guide')).toBe(false)
  })

  it('percentage never NaN or outside 0–100', () => {
    const cases: ProfileCompletionInput[] = [{}, completeBasic, { emailVerified: true }]
    for (const c of cases) {
      const p = computeProfileCompletion(c).percentage
      expect(Number.isNaN(p)).toBe(false)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }
  })

  it('missing items keep stable order', () => {
    const a = computeProfileCompletion({ hasAvatar: true })
    const b = computeProfileCompletion({ hasAvatar: true })
    expect(a.missing.map((m) => m.id)).toEqual(b.missing.map((m) => m.id))
    expect(a.missing.map((m) => m.id)).toEqual([
      'fullName',
      'username',
      'email',
      'emailVerified',
    ])
  })
})

describe('summarizeCompletionDisplay', () => {
  it('shows at most three missing and recommendation summary', () => {
    const result = computeProfileCompletion({})
    const display = summarizeCompletionDisplay(result)
    expect(display.missingPreview).toHaveLength(3)
    expect(display.headline).toContain('0%')
    expect(display.moreRecommendationsLabel).toMatch(/Još \d+ preporučena/)
  })

  it('complete basic shows done headline', () => {
    const display = summarizeCompletionDisplay(computeProfileCompletion(completeBasic))
    expect(display.headline).toBe('Osnovni Planinarski pasoš je dovršen.')
  })
})

describe('hasMembershipDocsFilled', () => {
  it('true when any membership field filled', () => {
    expect(hasMembershipDocsFilled({ legitimacija: '1' })).toBe(true)
    expect(hasMembershipDocsFilled({ markica: '  ' })).toBe(false)
  })
})
