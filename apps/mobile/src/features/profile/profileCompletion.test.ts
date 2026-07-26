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

describe('computeProfileCompletion (mobile)', () => {
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
  })

  it('complete basic profile is 100%', () => {
    expect(computeProfileCompletion(completeBasic).percentage).toBe(100)
  })

  it('whitespace counts as empty', () => {
    const result = computeProfileCompletion({
      fullName: '   ',
      username: '\t',
      email: ' ',
    })
    expect(result.completed).toBe(0)
  })

  it('unverified email is missing', () => {
    const result = computeProfileCompletion({ ...completeBasic, emailVerified: false })
    expect(result.missing.map((m) => m.id)).toEqual(['emailVerified'])
  })

  it('club does not affect basic percentage', () => {
    expect(computeProfileCompletion({ ...completeBasic, hasClub: false }).percentage).toBe(100)
    expect(computeProfileCompletion({ ...completeBasic, hasClub: true }).percentage).toBe(100)
  })

  it('non-guide has no guide recommendation', () => {
    expect(
      computeProfileCompletion({ ...completeBasic, guideStatus: 'non-guide' }).recommendations.some(
        (r) => r.id === 'guide',
      ),
    ).toBe(false)
  })

  it('guide none gets recommendation', () => {
    expect(
      computeProfileCompletion({ ...completeBasic, guideStatus: 'none' }).recommendations.some(
        (r) => r.id === 'guide',
      ),
    ).toBe(true)
  })

  it('percentage never NaN or outside 0–100', () => {
    const p = computeProfileCompletion({}).percentage
    expect(Number.isNaN(p)).toBe(false)
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(100)
  })

  it('stable missing order', () => {
    expect(computeProfileCompletion({}).missing.map((m) => m.id)).toEqual([
      'fullName',
      'username',
      'email',
      'emailVerified',
      'avatar',
    ])
  })

  it('same sense as web fixture for complete basic', () => {
    const result = computeProfileCompletion(completeBasic)
    const display = summarizeCompletionDisplay(result)
    expect(result.percentage).toBe(100)
    expect(display.headline).toBe('Osnovni Planinarski pasoš je dovršen.')
    expect(hasMembershipDocsFilled({ legitimacija: null, markica: null })).toBe(false)
  })
})
