import { describe, expect, it } from 'vitest'
import type { Prijava } from '../types/prijava'
import {
  countCapacityUsedPrijave,
  getActionCapacityUsedCount,
  getActionRegisteredCount,
  isActionCapacityFull,
  requiresActionSignupChoices,
} from './actionPricing'

function prijava(status: Prijava['status'], id = 1): Prijava {
  return {
    id,
    korisnik: `user${id}`,
    prijavljenAt: '2026-01-01T00:00:00Z',
    status,
    platio: false,
    selectedSmestajIds: [],
    selectedPrevozIds: [],
    selectedRentItems: [],
    saldo: 0,
    isClanKluba: true,
  }
}

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

describe('getActionCapacityUsedCount', () => {
  it('prefers backend capacityUsedCount when present', () => {
    expect(getActionCapacityUsedCount({ capacityUsedCount: 5, prijaveCount: 4 })).toBe(5)
  })

  it('counts active statuses from list when backend field is missing', () => {
    const prijave = [
      prijava('prijavljen', 1),
      prijava('prijavljen', 2),
      prijava('popeo se', 3),
      prijava('nije uspeo', 4),
      prijava('otkazano', 5),
    ]
    expect(getActionCapacityUsedCount({ prijaveCount: 2 }, prijave)).toBe(4)
    expect(countCapacityUsedPrijave(prijave)).toBe(4)
  })

  it('falls back to prijaveCount when no field and no list', () => {
    expect(getActionCapacityUsedCount({ prijaveCount: 3 })).toBe(3)
    expect(getActionCapacityUsedCount({})).toBe(0)
  })
})

describe('getActionRegisteredCount', () => {
  it('prefers backend prijaveCount when present', () => {
    const prijave = [prijava('prijavljen', 1), prijava('popeo se', 2), prijava('otkazano', 3)]
    expect(getActionRegisteredCount({ prijaveCount: 3 }, prijave)).toBe(3)
  })

  it('counts only prijavljen from list when backend field is missing', () => {
    const prijave = [
      prijava('prijavljen', 1),
      prijava('prijavljen', 2),
      prijava('prijavljen', 3),
      prijava('popeo se', 4),
      prijava('otkazano', 5),
    ]
    expect(getActionRegisteredCount({}, prijave)).toBe(3)
  })

  it('host list scenario: registered is not prijave.length', () => {
    const prijave = [
      prijava('prijavljen', 1),
      prijava('prijavljen', 2),
      prijava('prijavljen', 3),
      prijava('popeo se', 4),
      prijava('otkazano', 5),
    ]
    expect(prijave.length).toBe(5)
    expect(getActionRegisteredCount({ prijaveCount: 3 }, prijave)).toBe(3)
    expect(getActionCapacityUsedCount({ capacityUsedCount: 4, prijaveCount: 3 }, prijave)).toBe(4)
  })

  it('active action display scenario 4/5/5', () => {
    const action = { prijaveCount: 4, capacityUsedCount: 5, maxLjudi: 5 }
    expect(getActionRegisteredCount(action)).toBe(4)
    expect(getActionCapacityUsedCount(action)).toBe(5)
    expect(isActionCapacityFull(action.maxLjudi, getActionCapacityUsedCount(action))).toBe(true)
  })
})

describe('isActionCapacityFull', () => {
  it('treats maxLjudi 0 or missing as unlimited', () => {
    expect(isActionCapacityFull(0, 10)).toBe(false)
    expect(isActionCapacityFull(null, 10)).toBe(false)
    expect(isActionCapacityFull(undefined, 10)).toBe(false)
  })

  it('is full when capacityUsedCount equals maxLjudi', () => {
    expect(isActionCapacityFull(5, 5)).toBe(true)
  })

  it('is full when capacityUsedCount exceeds maxLjudi', () => {
    expect(isActionCapacityFull(5, 7)).toBe(true)
  })

  it('is not full when below maxLjudi', () => {
    expect(isActionCapacityFull(5, 4)).toBe(false)
  })
})
