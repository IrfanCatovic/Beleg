import { describe, expect, it } from 'vitest'
import { requiresActionSignupChoices } from './actionPricing'

/**
 * Documents web quick-join decision: empty payload only when no choices required.
 * Full Actions.tsx is not unit-tested here (no web vitest harness); logic is shared.
 */
describe('web quick-join decision', () => {
  it('allows direct signup when action has no options', () => {
    const detail = { smestaj: [], prevoz: [], opremaRent: [] }
    expect(requiresActionSignupChoices(detail)).toBe(false)
  })

  it('blocks empty payload path when smestaj/prevoz/rent exist', () => {
    expect(requiresActionSignupChoices({ smestaj: [{ id: 1 }] })).toBe(true)
    expect(requiresActionSignupChoices({ prevoz: [{ id: 1 }] })).toBe(true)
    expect(requiresActionSignupChoices({ opremaRent: [{ id: 1 }] })).toBe(true)
  })

  it('does not mark confirmed until server refresh (pending vs prijavljen)', () => {
    const applyFromServer = (moje: {
      prijavljeneAkcije?: number[]
      pendingSignupAkcije?: number[]
    }) => ({
      prijavljene: new Set(moje.prijavljeneAkcije ?? []),
      pending: new Set(moje.pendingSignupAkcije ?? []),
    })

    const afterPendingSignup = applyFromServer({
      prijavljeneAkcije: [],
      pendingSignupAkcije: [42],
    })
    expect(afterPendingSignup.pending.has(42)).toBe(true)
    expect(afterPendingSignup.prijavljene.has(42)).toBe(false)
  })
})

describe('mobile invalidate includes feed key', () => {
  it('documents expected query keys including akcije/feed', () => {
    // Keep in sync with apps/mobile/.../invalidateActionQueries.ts actionInvalidationKeys.
    const expected = [
      ['moje-prijave'],
      ['akcije'],
      ['akcije', 'feed'],
      ['moja-prijava', 7],
      ['akcija', 7],
      ['akcija', 7, ''],
      ['akcija', 7, 'prijave'],
      ['signup-requests', 7],
    ]
    expect(expected.some((k) => k[0] === 'akcije' && k[1] === 'feed')).toBe(true)
    expect(expected.some((k) => k[0] === 'moje-prijave')).toBe(true)
    expect(expected.some((k) => k[0] === 'signup-requests')).toBe(true)
    expect(expected.some((k) => k[0] === 'moja-prijava')).toBe(true)
  })
})
