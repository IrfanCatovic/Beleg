/**
 * Pure day-rollover logic for DailyStepsContext.
 *
 * Manual test checklist (midnight rollover):
 * - [ ] End day 1 with ~5746 steps; after local midnight HC shows ~64 → Planiner shows 64.
 * - [ ] Reopen app on day 2 with stale cache 5532 → first HC read corrects to 64.
 * - [ ] Same-day reads still monotonically increase (no regression during day 1).
 * - [ ] liveBonus from day 1 does not carry into day 2 display.
 */

export interface OsStepsBaseUpdate {
  base: number
  resetLiveBonus: boolean
  setDisplayToResult: boolean
  markReliable: boolean
}

/** First reliable OS read for the active day replaces cache; later reads only increase. */
export function resolveOsStepsBaseUpdate(
  resultSteps: number,
  currentBase: number,
  hasReliableOsRead: boolean,
): OsStepsBaseUpdate {
  if (!hasReliableOsRead) {
    return {
      base: resultSteps,
      resetLiveBonus: true,
      setDisplayToResult: true,
      markReliable: true,
    }
  }
  if (resultSteps > currentBase) {
    return {
      base: resultSteps,
      resetLiveBonus: true,
      setDisplayToResult: false,
      markReliable: false,
    }
  }
  return {
    base: currentBase,
    resetLiveBonus: false,
    setDisplayToResult: false,
    markReliable: false,
  }
}

/** Math.max guard applies only after the active day has a reliable OS baseline. */
export function resolveCommittedSteps(
  total: number,
  displaySteps: number,
  hasReliableOsRead: boolean,
): number {
  if (!hasReliableOsRead) {
    return total
  }
  return Math.max(displaySteps, total)
}

export function isNewDay(day: string, activeDay: string): boolean {
  return day !== activeDay
}
