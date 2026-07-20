import { describe, expect, it } from 'vitest'
import { requiresActionSignupChoices } from './actionPricing'

describe('requiresActionSignupChoices', () => {
  it('returns false when action has no option arrays', () => {
    expect(requiresActionSignupChoices({})).toBe(false)
    expect(requiresActionSignupChoices(null)).toBe(false)
    expect(requiresActionSignupChoices(undefined)).toBe(false)
  })

  it('returns false for empty option lists', () => {
    expect(
      requiresActionSignupChoices({
        smestaj: [],
        prevoz: [],
        opremaRent: [],
      }),
    ).toBe(false)
  })

  it('returns true when smestaj options exist', () => {
    expect(requiresActionSignupChoices({ smestaj: [{ id: 1 }] })).toBe(true)
  })

  it('returns true when prevoz options exist', () => {
    expect(requiresActionSignupChoices({ prevoz: [{ id: 2 }] })).toBe(true)
  })

  it('returns true when rent options exist', () => {
    expect(requiresActionSignupChoices({ opremaRent: [{ id: 3 }] })).toBe(true)
  })
})
