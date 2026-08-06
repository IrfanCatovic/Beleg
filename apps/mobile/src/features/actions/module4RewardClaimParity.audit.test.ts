import { describe, expect, it } from 'vitest'
import {
  decideSummitClaimIntent,
  isClaimRewardParamEnabled,
  isSummitRewardEligible,
} from '@beleg/shared'

/**
 * Web/mobile claimReward eligibility parity (M4-REWARD-WEB-1 closed).
 */

describe('M4-REWARD-WEB-CLAIM parity', () => {
  const unfinishedPopeoSe = {
    claimRewardRequested: true,
    isLoggedIn: true,
    akcijaLoaded: true,
    isCompleted: false,
    isCancelled: false,
    participationStatus: 'popeo se' as const,
  }

  it('mobile denies unfinished action even with popeo se', () => {
    expect(
      isSummitRewardEligible({
        isLoggedIn: true,
        isLoaded: true,
        isCompleted: false,
        isCancelled: false,
        participationStatus: 'popeo se',
      }),
    ).toBe(false)
  })

  it('web decideSummitClaimIntent denies unfinished + claimReward=1', () => {
    expect(
      decideSummitClaimIntent({
        claimReward: unfinishedPopeoSe.claimRewardRequested,
        alreadyConsumed: false,
        modalOpen: false,
        isLoggedIn: unfinishedPopeoSe.isLoggedIn,
        isLoaded: unfinishedPopeoSe.akcijaLoaded,
        isCompleted: unfinishedPopeoSe.isCompleted,
        isCancelled: unfinishedPopeoSe.isCancelled,
        participationStatus: unfinishedPopeoSe.participationStatus,
      }),
    ).toEqual({ action: 'consume-without-open' })
  })

  it('claimReward param only accepts exact 1', () => {
    expect(isClaimRewardParamEnabled('1')).toBe(true)
    expect(isClaimRewardParamEnabled(true)).toBe(true)
    expect(isClaimRewardParamEnabled('0')).toBe(false)
    expect(isClaimRewardParamEnabled('true')).toBe(false)
    expect(isClaimRewardParamEnabled('2')).toBe(false)
  })

  it('completed + popeo se opens once', () => {
    expect(
      decideSummitClaimIntent({
        claimReward: true,
        alreadyConsumed: false,
        modalOpen: false,
        isLoggedIn: true,
        isLoaded: true,
        isCompleted: true,
        isCancelled: false,
        participationStatus: 'popeo se',
      }),
    ).toEqual({ action: 'open' })
  })
})
