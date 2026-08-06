import { describe, expect, it } from 'vitest'
import { isSummitRewardEligible } from './utils/summitRewardEligibility'

/**
 * Documents web vs mobile claimReward eligibility gap.
 * Mobile requires isCompleted; web useActionShare opens on popeo se alone.
 */

function webClaimRewardWouldOpen(input: {
  claimRewardRequested: boolean
  isLoggedIn: boolean
  akcijaLoaded: boolean
  participationStatus: string | null
}): boolean {
  if (!input.claimRewardRequested) return false
  if (!input.isLoggedIn || !input.akcijaLoaded) return false
  // Actual web (src/hooks/action-details/useActionShare.ts): no isCompleted / isCancelled check.
  return input.participationStatus === 'popeo se'
}

describe('M4-REWARD-WEB-CLAIM gap', () => {
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

  it('web currently opens claimReward without isCompleted — documented actual', () => {
    expect(webClaimRewardWouldOpen(unfinishedPopeoSe)).toBe(true)
  })

  it('expected parity: web should match mobile and deny unfinished', () => {
    const expected =
      unfinishedPopeoSe.claimRewardRequested &&
      isSummitRewardEligible({
        isLoggedIn: unfinishedPopeoSe.isLoggedIn,
        isLoaded: unfinishedPopeoSe.akcijaLoaded,
        isCompleted: unfinishedPopeoSe.isCompleted,
        isCancelled: unfinishedPopeoSe.isCancelled,
        participationStatus: unfinishedPopeoSe.participationStatus,
      })
    if (webClaimRewardWouldOpen(unfinishedPopeoSe) && !expected) {
      throw new Error(
        'M4-REWARD-WEB-1 P2: web claimReward opens without isCompleted while mobile requires completed',
      )
    }
  })
})
