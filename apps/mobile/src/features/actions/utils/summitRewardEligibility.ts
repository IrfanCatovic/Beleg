export type SummitRewardEligibilityInput = {
  isLoggedIn: boolean
  isLoaded: boolean
  isCompleted: boolean
  isCancelled: boolean
  participationStatus?: string | null
}

/** Card/auto-open eligibility: completed climb with status "popeo se". */
export function isSummitRewardEligible(input: SummitRewardEligibilityInput): boolean {
  if (!input.isLoggedIn) return false
  if (!input.isLoaded) return false
  if (!input.isCompleted) return false
  if (input.isCancelled) return false
  return input.participationStatus === 'popeo se'
}

export type SummitClaimIntentInput = SummitRewardEligibilityInput & {
  claimReward: boolean
  alreadyConsumed: boolean
  modalOpen: boolean
}

export type SummitClaimIntentDecision =
  | { action: 'wait' }
  | { action: 'open' }
  | { action: 'consume-without-open' }
  | { action: 'noop' }

/**
 * One-time auto-open decision for claimReward route param.
 * Wait while loading; open once when eligible; consume without opening when definitively ineligible.
 */
export function decideSummitClaimIntent(input: SummitClaimIntentInput): SummitClaimIntentDecision {
  if (!input.claimReward) return { action: 'noop' }
  if (input.alreadyConsumed || input.modalOpen) return { action: 'noop' }
  if (!input.isLoaded) return { action: 'wait' }
  if (isSummitRewardEligible(input)) return { action: 'open' }
  return { action: 'consume-without-open' }
}
