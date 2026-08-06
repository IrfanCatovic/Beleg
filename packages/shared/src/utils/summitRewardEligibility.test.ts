import { describe, expect, it } from 'vitest'
import {
  decideSummitClaimIntent,
  isSummitRewardEligible,
} from './summitRewardEligibility'

describe('isSummitRewardEligible', () => {
  const base = {
    isLoggedIn: true,
    isLoaded: true,
    isCompleted: true,
    isCancelled: false,
    participationStatus: 'popeo se' as string | null,
  }

  it('logged-out → false', () => {
    expect(isSummitRewardEligible({ ...base, isLoggedIn: false })).toBe(false)
  })

  it('data not loaded → false', () => {
    expect(isSummitRewardEligible({ ...base, isLoaded: false })).toBe(false)
  })

  it('active action → false', () => {
    expect(isSummitRewardEligible({ ...base, isCompleted: false })).toBe(false)
  })

  it('cancelled → false', () => {
    expect(isSummitRewardEligible({ ...base, isCancelled: true })).toBe(false)
  })

  it('completed + no participation → false', () => {
    expect(isSummitRewardEligible({ ...base, participationStatus: null })).toBe(false)
  })

  it('completed + status not popeo se → false', () => {
    expect(isSummitRewardEligible({ ...base, participationStatus: 'prijavljen' })).toBe(false)
    expect(isSummitRewardEligible({ ...base, participationStatus: 'nije uspeo' })).toBe(false)
  })

  it('completed + popeo se → true', () => {
    expect(isSummitRewardEligible(base)).toBe(true)
  })

  it('organizator without popeo se → false', () => {
    expect(isSummitRewardEligible({ ...base, participationStatus: undefined })).toBe(false)
  })

  it('missing/unknown status → false', () => {
    expect(isSummitRewardEligible({ ...base, participationStatus: '' })).toBe(false)
    expect(isSummitRewardEligible({ ...base, participationStatus: 'mystery' })).toBe(false)
  })
})

describe('decideSummitClaimIntent', () => {
  const eligible = {
    claimReward: true,
    alreadyConsumed: false,
    modalOpen: false,
    isLoggedIn: true,
    isLoaded: true,
    isCompleted: true,
    isCancelled: false,
    participationStatus: 'popeo se',
  }

  it('claim param false → noop', () => {
    expect(decideSummitClaimIntent({ ...eligible, claimReward: false })).toEqual({
      action: 'noop',
    })
  })

  it('data loading → wait', () => {
    expect(decideSummitClaimIntent({ ...eligible, isLoaded: false })).toEqual({
      action: 'wait',
    })
  })

  it('completed + eligible → open', () => {
    expect(decideSummitClaimIntent(eligible)).toEqual({ action: 'open' })
  })

  it('already consumed → noop', () => {
    expect(decideSummitClaimIntent({ ...eligible, alreadyConsumed: true })).toEqual({
      action: 'noop',
    })
  })

  it('modal already open → noop', () => {
    expect(decideSummitClaimIntent({ ...eligible, modalOpen: true })).toEqual({
      action: 'noop',
    })
  })

  it('neeligible after load → consume-without-open', () => {
    expect(
      decideSummitClaimIntent({ ...eligible, participationStatus: 'prijavljen' }),
    ).toEqual({ action: 'consume-without-open' })
  })

  it('cancelled → consume-without-open', () => {
    expect(decideSummitClaimIntent({ ...eligible, isCancelled: true })).toEqual({
      action: 'consume-without-open',
    })
  })

  it('logged-out after load → consume-without-open', () => {
    expect(decideSummitClaimIntent({ ...eligible, isLoggedIn: false })).toEqual({
      action: 'consume-without-open',
    })
  })

  it('active (not completed) → consume-without-open', () => {
    expect(decideSummitClaimIntent({ ...eligible, isCompleted: false })).toEqual({
      action: 'consume-without-open',
    })
  })
})
